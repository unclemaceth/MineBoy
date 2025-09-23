import { FastifyInstance } from 'fastify';
import { listPendingWithTx, confirmClaimById, failClaim, expireStalePending } from '../db.js';

// Validation and normalization for transaction hashes
function normalizeTx(h: string | null | undefined): string | null {
  if (!h) return null;
  const tx = h.trim().toLowerCase();
  // Validate 0x + 64 hex chars
  if (!/^0x[0-9a-f]{64}$/.test(tx)) return null;
  return tx;
}

export async function registerAdminPollerRoute(fastify: FastifyInstance) {
  // Temporary debug endpoint to check admin token
  fastify.get('/v2/admin/debug-token', async (req, reply) => {
    return {
      hasToken: !!process.env.ADMIN_TOKEN,
      tokenLength: process.env.ADMIN_TOKEN?.length || 0,
      tokenStart: process.env.ADMIN_TOKEN?.substring(0, 4) || 'none'
    };
  });

  // Test RPC connection
  fastify.get('/v2/admin/test-rpc', async (req, reply) => {
    try {
      const { createPublicClient, http } = await import('viem');
      const { base } = await import('viem/chains');
      
      const provider = createPublicClient({
        chain: base,
        transport: http(process.env.RPC_URL!)
      });

      // Test with a known confirmed transaction
      const receipt = await provider.getTransactionReceipt('0x624f71e436219c875ebf38a1da12f57cd1a7db48124f198b04dc6dac567acff1');
      
      return {
        rpcUrl: process.env.RPC_URL,
        receipt: receipt ? {
          status: receipt.status,
          blockNumber: receipt.blockNumber,
          found: true
        } : { found: false }
      };
    } catch (error) {
      return {
        rpcUrl: process.env.RPC_URL,
        error: String(error)
      };
    }
  });

  // Dry run endpoint to debug poller behavior
  fastify.get('/v2/admin/poller/dry-run', async (req, reply) => {
    const limit = parseInt((req.query as any).limit || '10');
    const pending = await listPendingWithTx();
    const sample = pending.slice(0, limit);
    
    const { createPublicClient, http, defineChain } = await import('viem');
    
    const CURTIS_CHAIN = defineChain({
      id: 33111,
      name: "Curtis",
      nativeCurrency: { name: "ABIT", symbol: "ABIT", decimals: 18 },
      rpcUrls: { default: { http: [process.env.RPC_URL!] } },
    });
    
    const provider = createPublicClient({
      chain: CURTIS_CHAIN,
      transport: http(process.env.RPC_URL!)
    });
    
    const out = [];
    
    for (const r of sample) {
      const tx = normalizeTx(r.tx_hash);
      let ping: any = null;
      
      try {
        if (tx) {
          const receipt = await provider.getTransactionReceipt({ hash: tx as `0x${string}` });
          // Convert BigInt values to strings for JSON serialization
          ping = receipt ? {
            status: receipt.status,
            blockNumber: receipt.blockNumber?.toString(),
            transactionHash: receipt.transactionHash,
            found: true
          } : { found: false };
        } else {
          ping = { error: 'Invalid tx_hash format' };
        }
      } catch (e: any) {
        ping = { error: String(e) };
      }
      
      out.push({ 
        id: r.id, 
        raw: r.tx_hash, 
        tx_normalized: tx, 
        ping 
      });
    }
    
    return { ok: true, sample: out };
  });

  fastify.post('/v2/admin/poller/run-once', async (req, reply) => {
    const auth = req.headers.authorization || '';
    console.log(`[ADMIN_AUTH] Received: "${auth}"`);
    console.log(`[ADMIN_AUTH] Expected: "Bearer ${process.env.ADMIN_TOKEN}"`);
    console.log(`[ADMIN_AUTH] ADMIN_TOKEN set: ${!!process.env.ADMIN_TOKEN}`);
    
    if (!process.env.ADMIN_TOKEN || auth !== `Bearer ${process.env.ADMIN_TOKEN}`) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const now = Date.now();
      
      // Expire old pending claims (24h+ old)
      await expireStalePending(now - 24 * 60 * 60 * 1000);
      
      // Get pending claims with tx_hash
      const pending = await listPendingWithTx();
      
      if (!pending.length) {
        return { ok: true, message: 'No pending claims to check', pending: 0, confirmed: 0, failed: 0 };
      }

      console.log(`📊 Manual poller checking ${pending.length} pending claims`);
      
      let confirmed = 0;
      let failed = 0;
      
      // Create client for chain 33111 (Curtis)
      const { createPublicClient, http, defineChain } = await import('viem');
      
      const CURTIS_CHAIN = defineChain({
        id: 33111,
        name: "Curtis",
        nativeCurrency: { name: "ABIT", symbol: "ABIT", decimals: 18 },
        rpcUrls: { default: { http: [process.env.RPC_URL!] } },
      });
      
      const provider = createPublicClient({
        chain: CURTIS_CHAIN,
        transport: http(process.env.RPC_URL!)
      });

      for (const row of pending) {
        try {
          // Normalize and validate tx_hash
          const tx = normalizeTx(row.tx_hash);
          if (!tx) {
            console.warn(`📊 Skip row with invalid tx_hash`, { id: row.id, raw: row.tx_hash });
            continue;
          }
          
          console.log(`📊 Checking claim ${row.id} with normalized tx: ${tx}`);
          
          const receipt = await provider.getTransactionReceipt({ hash: tx as `0x${string}` });
          if (!receipt) {
            console.log(`📊 No receipt found for tx ${tx}`);
            continue; // Still pending
          }
          
          // viem returns status as "success" | "reverted"
          if (receipt.status === "success") {
            console.log(`📊 Attempting to confirm claim ${row.id} with tx ${tx}`);
            await confirmClaimById(row.id, tx, now);
            confirmed++;
            console.log(`📊 ✅ Successfully confirmed claim ${row.id}`);
          } else {
            console.log(`📊 Attempting to fail claim ${row.id} - status: ${receipt.status}`);
            await failClaim(row.id);
            failed++;
            console.log(`📊 ✅ Successfully failed claim ${row.id}`);
          }
        } catch (error: any) {
          if (error?.name === "TransactionNotFoundError") {
            console.log(`📊 Transaction not found: ${row.tx_hash}`);
            continue; // Still pending
          }
          console.warn(`📊 RPC error checking tx ${row.tx_hash}:`, error);
        }
      }

      return { 
        ok: true, 
        message: `Processed ${pending.length} claims`,
        pending: pending.length,
        confirmed,
        failed
      };
    } catch (error) {
      console.error('Manual poller error:', error);
      return reply.code(500).send({ error: 'Manual poller failed', details: String(error) });
    }
  });
}
