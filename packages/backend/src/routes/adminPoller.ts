import { FastifyInstance } from 'fastify';
import { listPendingWithTx, confirmClaimById, failClaim, expireStalePending } from '../db.js';

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
      
      // Simple RPC check (you might want to use the same provider as the main poller)
      const { createPublicClient, http } = await import('viem');
      const { base } = await import('viem/chains');
      
      const provider = createPublicClient({
        chain: base,
        transport: http(process.env.RPC_URL!)
      });

      for (const row of pending) {
        try {
          console.log(`📊 Checking claim ${row.id} with tx_hash: ${row.tx_hash}`);
          if (!row.tx_hash) {
            console.log(`📊 Skipping claim ${row.id} - no tx_hash`);
            continue;
          }
          const receipt = await provider.getTransactionReceipt(row.tx_hash);
          if (!receipt) {
            console.log(`📊 No receipt found for tx ${row.tx_hash}`);
            continue; // Still pending
          }
          
          if (receipt.status === 1n || receipt.status === 1) {
            await confirmClaimById(row.id, row.tx_hash!, now);
            confirmed++;
            console.log(`📊 Confirmed claim ${row.id}`);
          } else {
            await failClaim(row.id);
            failed++;
            console.log(`📊 Failed claim ${row.id}`);
          }
        } catch (error) {
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
