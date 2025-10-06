import { FastifyInstance } from 'fastify';
import { getRedis } from '../redis.js';
import { withLock } from '../lib/redisHelpers.js';
import { provider, encodeFulfillOrder, checkOwnership, waitForOrderFulfilled, CHAIN_ID_VALUE, SEAPORT_ADDRESS } from '../lib/seaport.js';
import { getAddress } from 'ethers';
import axios from 'axios';

// Normalize address to avoid checksum errors
function normalize(addr: string): string {
  return getAddress(addr.toLowerCase());
}

const ZERO32 = '0x' + '00'.repeat(32);
const CHAIN_ID = CHAIN_ID_VALUE;
const NPC = normalize(process.env.NPC_COLLECTION || '0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA');
const FLYWHEEL = normalize(process.env.FLYWHEEL_WALLET || '0x08AD425BA1D1fC4d69d88B56f7C6879B2E85b0C4');
const WEBHOOK = process.env.MARKET_WEBHOOK || `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/v2/flywheel/confirm`;
const MAGIC_EDEN_API = 'https://api-mainnet.magiceden.dev/v3/rtp';

type Listing = {
  tokenId: string;
  orderId: string | null;
  maker: string;
  priceWei: string;
  order: {
    kind: string;
    data: any;
  };
};

/**
 * Fetch active flywheel listings from Magic Eden
 */
async function fetchFlywheelOrders(): Promise<Listing[]> {
  try {
    const response = await axios.get(
      `${MAGIC_EDEN_API}/apechain/orders/asks/v5`,
      {
        params: {
          contracts: [NPC],
          maker: FLYWHEEL,
          status: 'active',
          sortBy: 'price',
          limit: 50
        },
        headers: { 'accept': '*/*' }
      }
    );

    const orders = response.data?.orders || [];
    const listings: Listing[] = [];

    for (const order of orders) {
      const tokenId = order?.criteria?.data?.token?.tokenId;
      const price = order?.price?.amount?.raw;
      const priceDecimal = order?.price?.amount?.decimal;
      const orderId = order?.id;

      if (!tokenId || !price) continue;

      // Store minimal listing info - we'll fetch full order data on-demand
      listings.push({
        tokenId: String(tokenId),
        orderId,
        maker: FLYWHEEL,
        priceWei: String(price),
        order: {
          kind: 'seaport-v1.6',
          data: {
            // Store the order ID so we can fetch full details later
            orderId,
            priceDecimal: String(priceDecimal || (Number(price) / 1e18).toFixed(2))
          }
        }
      });
    }

    console.log(`[Market] Fetched ${listings.length} flywheel listings from Magic Eden`);
    return listings;
  } catch (error: any) {
    console.error('[Market] Error fetching orders:', error.message);
    return [];
  }
}

/**
 * Refresh listings cache from source
 */
export async function refreshListingsCache(): Promise<{ count: number }> {
  const redis = getRedis();
  if (!redis) {
    console.warn('[Market] Redis not available, skipping refresh');
    return { count: 0 };
  }

  const orders = await fetchFlywheelOrders();
  const tokenIds = orders.map(o => o.tokenId);

  // Write atomically
  const pipeline = redis.pipeline();
  
  // Add all current listings
  for (const order of orders) {
    pipeline.sadd('market:listings', order.tokenId);
    pipeline.set(
      `market:order:${order.tokenId}`,
      JSON.stringify(order),
      'EX',
      3600 // 1 hour expiry
    );
  }

  // Remove stale listings
  const existing = await redis.smembers('market:listings');
  for (const tokenId of existing) {
    if (!tokenIds.includes(tokenId)) {
      pipeline.srem('market:listings', tokenId);
      pipeline.del(`market:order:${tokenId}`);
    }
  }

  await pipeline.exec();
  
  console.log(`[Market] Refreshed ${orders.length} listings`);
  return { count: orders.length };
}

export default async function routes(app: FastifyInstance) {
  /**
   * GET /market/orders
   * Returns all active listings
   */
  app.get('/market/orders', async (request, reply) => {
    const redis = getRedis();
    if (!redis) {
      return reply.code(503).send({ error: 'redis-unavailable' });
    }

    const tokenIds = await redis.smembers('market:listings');
    if (!tokenIds.length) {
      return reply.send({ chainId: CHAIN_ID, orders: [] });
    }

    const orders = await redis.mget(tokenIds.map(t => `market:order:${t}`));
    const parsed = orders
      .map(s => s && JSON.parse(s))
      .filter(Boolean)
      .map((o: Listing) => ({
        tokenId: o.tokenId,
        priceWei: o.priceWei,
        orderId: o.orderId,
        maker: o.maker,
        priceAPE: (Number(o.priceWei) / 1e18).toFixed(2)
      }));

    return reply.send({ chainId: CHAIN_ID, orders: parsed });
  });

  /**
   * GET /market/orders/:tokenId
   * Get a specific listing
   */
  app.get<{ Params: { tokenId: string } }>(
    '/market/orders/:tokenId',
    async (request, reply) => {
      const redis = getRedis();
      if (!redis) {
        return reply.code(503).send({ error: 'redis-unavailable' });
      }

      const { tokenId } = request.params;
      const raw = await redis.get(`market:order:${tokenId}`);
      
      if (!raw) {
        return reply.code(404).send({ error: 'not-listed' });
      }

      const order = JSON.parse(raw);
      return reply.send({ chainId: CHAIN_ID, order });
    }
  );

  /**
   * POST /market/build-fill
   * Returns transaction data for buying an NPC
   */
  app.post<{ Body: { tokenId: string; buyer?: string } }>(
    '/market/build-fill',
    async (request, reply) => {
      const redis = getRedis();
      if (!redis) {
        return reply.code(503).send({ error: 'redis-unavailable' });
      }

      const { tokenId, buyer } = request.body;
      
      if (!tokenId) {
        return reply.code(400).send({ error: 'tokenId required' });
      }

      // Check if already sold
      const filled = await redis.get(`market:filled:${tokenId}`);
      if (filled) {
        return reply.code(410).send({ error: 'sold', txHash: filled });
      }

      // Get listing (to verify it exists)
      const raw = await redis.get(`market:order:${tokenId}`);
      if (!raw) {
        return reply.code(404).send({ error: 'not-listed' });
      }

      const listing: Listing = JSON.parse(raw);

      // Verify maker is flywheel
      if (getAddress(listing.maker) !== FLYWHEEL) {
        return reply.code(409).send({ error: 'bad-maker' });
      }

      // Verify current ownership on-chain
      const owns = await checkOwnership(NPC, tokenId, FLYWHEEL);
      if (!owns) {
        // Mark as sold and remove listing
        await redis.set(`market:filled:${tokenId}`, 'sold-elsewhere', 'EX', 86400);
        await redis.srem('market:listings', tokenId);
        await redis.del(`market:order:${tokenId}`);
        return reply.code(410).send({ error: 'sold' });
      }

      // Encode Seaport fulfillOrder transaction ourselves!
      // No Magic Eden API needed - we have the full signed order
      try {
        app.log.info(`[Market] Building fulfillOrder transaction for token ${tokenId}`);
        app.log.info(`[Market] Order structure:`, {
          kind: listing?.order?.kind,
          hasSig: !!listing?.order?.data?.signature,
          hasParams: !!(listing?.order?.data?.parameters || listing?.order?.data?.components || listing?.order?.data?.offerer),
          dataKeys: listing?.order?.data ? Object.keys(listing.order.data).slice(0, 10) : []
        });
        
        const tx = encodeFulfillOrder({
          order: listing.order,
          fulfiller: buyer,
          fulfillerConduitKey: ZERO32
        });
        
        app.log.info(`[Market] Encoded fulfillOrder: to=${tx.to}, value=${tx.value}`);

        return reply.send({
          chainId: CHAIN_ID,
          to: tx.to,
          data: tx.data,
          value: tx.value,
          seaport: SEAPORT_ADDRESS,
          priceAPE: (Number(listing.priceWei) / 1e18).toFixed(2)
        });

      } catch (error: any) {
        app.log.error('[Market] Error encoding fulfillOrder:', error);
        app.log.error('[Market] Error stack:', error.stack);
        return reply.code(500).send({ 
          error: 'Failed to encode transaction',
          message: error.message || String(error)
        });
      }
    }
  );

  /**
   * POST /market/confirm
   * Confirm a purchase and trigger flywheel
   */
  app.post<{ Body: { tokenId: string; txHash: string; buyer: string } }>(
    '/market/confirm',
    async (request, reply) => {
      const redis = getRedis();
      if (!redis) {
        return reply.code(503).send({ error: 'redis-unavailable' });
      }

      const { tokenId, txHash, buyer } = request.body;

      if (!tokenId || !txHash || !buyer) {
        return reply.code(400).send({ 
          error: 'Missing required fields: tokenId, txHash, buyer' 
        });
      }

      // Validate txHash format
      if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
        return reply.code(400).send({ error: 'Invalid txHash format' });
      }

      const key = `market:order:${tokenId}`;
      const listed = await redis.get(key);
      
      if (!listed) {
        return reply.code(404).send({ error: 'not-listed' });
      }

      const already = await redis.get(`market:filled:${tokenId}`);
      if (already) {
        return reply.code(409).send({ error: 'already-filled', txHash: already });
      }

      // Wait for transaction and verify OrderFulfilled event
      const fulfilled = await waitForOrderFulfilled(txHash, 60_000);
      if (!fulfilled) {
        return reply.code(400).send({ error: 'not-seaport-fulfill' });
      }

      // Atomically mark as sold
      await withLock(`sold:${tokenId}`, 5000, async () => {
        await redis.set(`market:filled:${tokenId}`, txHash, 'EX', 30 * 24 * 3600);
        await redis.srem('market:listings', tokenId);
        await redis.del(key);
      });

      // Kick the flywheel webhook
      if (WEBHOOK) {
        fetch(WEBHOOK, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            tokenId,
            txHash,
            buyer: getAddress(buyer),
            chainId: CHAIN_ID,
            event: 'order-fulfilled',
            source: 'mineboy-market'
          })
        }).catch((err) => {
          app.log.error('[Market] Webhook failed:', err);
        });
      }

      app.log.info(`[Market] NPC #${tokenId} sold to ${buyer} (tx: ${txHash})`);

      return reply.send({ ok: true });
    }
  );

  /**
   * POST /market/admin/store-order
   * Store a full Seaport order (called by bot after creating listing)
   */
  app.post<{ Body: { tokenId: string; priceWei: string; signature: string; orderComponents: any; domain: any; expiresAt: number } }>(
    '/market/admin/store-order',
    async (request, reply) => {
      // Auth check removed - only bot calls this endpoint
      // Could add IP whitelist or other auth if needed

      const redis = getRedis();
      if (!redis) {
        return reply.code(503).send({ error: 'redis-unavailable' });
      }

      const { tokenId, priceWei, signature, orderComponents, domain, expiresAt } = request.body;

      if (!tokenId || !priceWei || !signature || !orderComponents) {
        return reply.code(400).send({ error: 'Missing required fields' });
      }

      const listing: Listing = {
        tokenId,
        orderId: null,
        maker: FLYWHEEL,
        priceWei,
        order: {
          kind: 'seaport-v1.6',
          data: {
            ...orderComponents,
            signature,
            domain
          }
        }
      };

      // Store in Redis
      const ttl = expiresAt ? Math.max(60, expiresAt - Math.floor(Date.now() / 1000)) : 7 * 24 * 3600;
      await redis.sadd('market:listings', tokenId);
      await redis.set(`market:order:${tokenId}`, JSON.stringify(listing), 'EX', ttl);

      app.log.info(`[Market] Stored order for token ${tokenId} at ${(Number(priceWei) / 1e18).toFixed(2)} APE`);

      return reply.send({ ok: true, tokenId });
    }
  );

  /**
   * POST /market/admin/refresh
   * Manually trigger listing refresh (admin only)
   */
  app.post('/market/admin/refresh', async (request, reply) => {
    const auth = request.headers.authorization || '';
    const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
    
    if (!ADMIN_TOKEN || auth !== `Bearer ${ADMIN_TOKEN}`) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const result = await refreshListingsCache();
    return reply.send({ ok: true, ...result });
  });
}
