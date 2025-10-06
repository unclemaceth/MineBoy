import { FastifyInstance } from 'fastify';
import { JsonRpcProvider, Contract, formatEther, formatUnits } from 'ethers';
import axios from 'axios';

const RPC_URL = process.env.RPC_URL || 'https://rpc.apechain.com/http';
const MNESTR = '0xAe0DfbB1a2b22080F947D1C0234c415FabEEc276';
const NPC_COLLECTION = '0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA';
const FLYWHEEL_WALLET = '0x08AD425BA1D1fC4d69d88B56f7C6879B2E85b0C4';
const DEX_ROUTER = '0x18E621B64d7808c3C47bccbbD7485d23F257D26f';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function cap() view returns (uint256)'
];

// Common burn addresses
const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const ERC721_ABI = [
  'function ownerOf(uint256) view returns (address)'
];

const ROUTER_ABI = [
  'function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[])'
];

const WAPE = '0x48b62137EdfA95a428D35C09E44256a739F6B557';

// In-memory cache for expensive operations
let cache: {
  lastFetch: number;
  data: any;
} = { lastFetch: 0, data: null };

const CACHE_TTL = 30000; // 30 seconds

export default async function routes(app: FastifyInstance) {
  /**
   * POST /v2/flywheel/confirm
   * Webhook endpoint for order fulfillment
   * Triggered when an NPC is sold via the market
   */
  app.post<{ Body: { tokenId: string; txHash: string; buyer: string; event: string } }>(
    '/v2/flywheel/confirm',
    async (request, reply) => {
      const { tokenId, txHash, buyer, event } = request.body;

      if (event !== 'order-fulfilled') {
        return reply.code(400).send({ error: 'Invalid event type' });
      }

      app.log.info(`[Flywheel] Order fulfilled: NPC #${tokenId} sold to ${buyer} (tx: ${txHash})`);

      try {
        // Here's where the flywheel logic would execute:
        // 1. Confirm NPC ownership transferred
        // 2. Receive APE payment (already in wallet)
        // 3. Swap 99% APE → MNESTR
        // 4. Burn MNESTR
        // 5. Keep 1% APE for gas
        // 6. Log the sale for stats

        // For now, just log and acknowledge
        app.log.info(`[Flywheel] Sale recorded: tokenId=${tokenId}, buyer=${buyer}, tx=${txHash}`);
        
        // TODO: Implement actual flywheel logic here
        // - Call bot to execute burn sequence
        // - Update stats in DB
        // - Clear this NPC from owned inventory

        return reply.send({ 
          ok: true, 
          message: 'Flywheel triggered',
          tokenId,
          buyer,
          txHash
        });

      } catch (error: any) {
        app.log.error(`[Flywheel] Error processing sale: ${error.message}`);
        return reply.code(500).send({ 
          error: 'Failed to process sale',
          message: error.message 
        });
      }
    }
  );

  app.get('/v2/flywheel/stats', async (request, reply) => {
    try {
      // Return cached data if fresh
      const now = Date.now();
      if (cache.data && (now - cache.lastFetch) < CACHE_TTL) {
        return reply.send(cache.data);
      }

      const provider = new JsonRpcProvider(RPC_URL, 33139);

      // Fetch APE balance
      const apeBalance = await provider.getBalance(FLYWHEEL_WALLET);
      const apeBalanceFormatted = parseFloat(formatEther(apeBalance)).toFixed(4);

      // Fetch MNESTR data
      const mnestr = new Contract(MNESTR, ERC20_ABI, provider);
      const [decimals, totalSupply, cap, deadBalance, zeroBalance] = await Promise.all([
        mnestr.decimals(),
        mnestr.totalSupply(),
        mnestr.cap(),
        mnestr.balanceOf(BURN_ADDRESS),
        mnestr.balanceOf(ZERO_ADDRESS)
      ]);

      const totalSupplyFormatted = formatUnits(totalSupply, decimals);
      const capFormatted = formatUnits(cap, decimals);
      
      // Calculate unminted (available to mint)
      const unminted = parseFloat(capFormatted) - parseFloat(totalSupplyFormatted);
      
      // Calculate actually burned (sent to burn addresses)
      const actuallyBurned = parseFloat(formatUnits(deadBalance, decimals)) + parseFloat(formatUnits(zeroBalance, decimals));

      // Get MNESTR price from Camelot (1 MNESTR = ? APE)
      let mnestrPrice = '0.0001';
      let marketCap = '0';
      try {
        const router = new Contract(DEX_ROUTER, ROUTER_ABI, provider);
        const oneToken = BigInt(10 ** Number(decimals)); // 1 MNESTR
        const path = [MNESTR, WAPE];
        const amounts = await router.getAmountsOut(oneToken, path);
        mnestrPrice = parseFloat(formatEther(amounts[1])).toFixed(8);
        marketCap = (parseFloat(totalSupplyFormatted) * parseFloat(mnestrPrice)).toFixed(2);
      } catch (err) {
        app.log.warn('Failed to fetch MNESTR price from DEX:', err);
      }

      // Fetch cheapest NPC from Magic Eden API
      let cheapestNPC = null;
      try {
        const response = await fetch(
          `https://api-mainnet.magiceden.dev/v3/rtp/apechain/tokens/v7?collection=${NPC_COLLECTION}&sortBy=floorAskPrice&limit=1`,
          {
            headers: {
              'accept': '*/*',
              'x-me-origin': 'mineboy'
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.tokens && data.tokens.length > 0) {
            const token = data.tokens[0];
            if (token.market?.floorAsk?.price?.amount?.native) {
              cheapestNPC = {
                tokenId: token.token.tokenId,
                price: parseFloat(token.market.floorAsk.price.amount.native).toFixed(4)
              };
            }
          }
        }
      } catch (err) {
        app.log.warn('Failed to fetch cheapest NPC:', err);
      }

      // Check owned NPCs on-chain
      const ownedNPCs: any[] = [];
      try {
        // Check a reasonable range of token IDs (1-2000)
        // This is a simple approach - could optimize with events/indexing later
        const npcContract = new Contract(NPC_COLLECTION, ERC721_ABI, provider);
        const checkPromises = [];
        
        // Check all 2222 NPC tokens
        for (let i = 1; i <= 2222; i++) {
          checkPromises.push(
            npcContract.ownerOf(i)
              .then((owner: string) => {
                if (owner.toLowerCase() === FLYWHEEL_WALLET.toLowerCase()) {
                  return i;
                }
                return null;
              })
              .catch(() => null) // Token doesn't exist or error
          );
        }
        
        const results = await Promise.all(checkPromises);
        const owned = results.filter(id => id !== null);
        
        // Query ALL active listings by flywheel wallet at once (more efficient)
        const listingsByToken = new Map<string, string>(); // tokenId -> price
        
        try {
          app.log.info(`[Flywheel] Checking Magic Eden for active listings by ${FLYWHEEL_WALLET}...`);
          
          const ordersResponse = await axios.get(
            `https://api-mainnet.magiceden.dev/v3/rtp/apechain/orders/asks/v5`,
            {
              params: {
                contracts: [NPC_COLLECTION],
                maker: FLYWHEEL_WALLET,
                status: 'active',
                sortBy: 'price',
                limit: 50 // Get up to 50 listings
              },
              headers: {
                'accept': '*/*'
              }
            }
          );
          
          const orders = ordersResponse.data?.orders || [];
          app.log.info(`[Flywheel] Found ${orders.length} active listings from flywheel wallet`);
          
          // Map each listing to its tokenId
          for (const order of orders) {
            const criteria = order?.criteria;
            if (criteria?.data?.token?.tokenId) {
              const tokenId = String(criteria.data.token.tokenId);
              const priceDecimal = order?.price?.amount?.decimal;
              if (priceDecimal) {
                listingsByToken.set(tokenId, priceDecimal.toFixed(2));
                app.log.info(`[Flywheel] Token ${tokenId} listed at ${priceDecimal.toFixed(2)} APE`);
              }
            }
          }
        } catch (err: any) {
          app.log.error(`[Flywheel] Error fetching listings from Magic Eden: ${err.message}`);
        }
        
        // Build owned NPCs array with listing status
        for (const tokenId of owned) {
          const listedPrice = listingsByToken.get(String(tokenId)) || null;
          
          ownedNPCs.push({
            tokenId: String(tokenId),
            acquired: 'Unknown', // Could track this in DB
            listedPrice
          });
        }
      } catch (err) {
        app.log.warn('Failed to check owned NPCs:', err);
      }
      
      // TODO: Track sales in database
      const previousSales: any[] = [];

      const stats = {
        apeBalance: apeBalanceFormatted,
        mnestrPrice,
        mnestrMarketCap: marketCap,
        mnestrCap: (parseFloat(capFormatted) / 1000000).toFixed(2) + 'M',
        mnestrSupply: (parseFloat(totalSupplyFormatted) / 1000000).toFixed(2) + 'M',
        mnestrUnminted: (unminted / 1000000).toFixed(2) + 'M',
        mnestrBurned: (actuallyBurned / 1000000).toFixed(2) + 'M',
        cheapestNPC,
        ownedNPCs,
        previousSales
      };

      // Update cache
      cache = {
        lastFetch: now,
        data: stats
      };

      return reply.send(stats);
    } catch (error: any) {
      app.log.error('Failed to fetch flywheel stats:', error);
      return reply.code(500).send({ 
        error: 'Failed to fetch flywheel stats',
        message: error.message 
      });
    }
  });
}
