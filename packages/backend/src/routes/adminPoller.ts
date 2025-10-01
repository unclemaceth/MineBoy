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

  // Single claim confirmation endpoint for testing
  fastify.post('/v2/admin/claim/:id/confirm', async (req, reply) => {
    const auth = req.headers.authorization || '';
    if (!process.env.ADMIN_TOKEN || auth !== `Bearer ${process.env.ADMIN_TOKEN}`) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = req.params as { id: string };
    const { tx } = req.body as { tx?: string } || {};
    
    try {
      console.log(`📊 [ADMIN] Single confirm attempt`, { id, tx });
      const ok = await confirmClaimById(id, tx || '', Date.now());
      return { ok };
    } catch (e) {
      console.error(`📊 [ADMIN] Single confirm error`, { id, error: String(e) });
      return reply.code(500).send({ ok: false, error: String(e) });
    }
  });

  // Audit and fix inflated scores - re-verify all confirmed claims (batched)
  fastify.post('/v2/admin/audit-claims', async (req, reply) => {
    const auth = req.headers.authorization || '';
    if (!process.env.ADMIN_TOKEN || auth !== `Bearer ${process.env.ADMIN_TOKEN}`) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const { limit, offset } = req.body as { limit?: number; offset?: number } || {};
      const batchSize = Math.min(limit || 100, 500); // Max 500 per batch
      const batchOffset = offset || 0;

      const { getDB } = await import('../db.js');
      const db = getDB();
      
      // Get total count
      const countResult = await db.pool.query(
        `SELECT COUNT(*) as total FROM claims WHERE status='confirmed' AND tx_hash IS NOT NULL`
      );
      const totalClaims = parseInt(countResult.rows[0].total, 10);
      
      // Get batch of confirmed claims with tx_hash
      const result = await db.pool.query(
        `SELECT id, tx_hash, wallet, amount_wei 
         FROM claims 
         WHERE status='confirmed' AND tx_hash IS NOT NULL
         ORDER BY confirmed_at DESC
         LIMIT $1 OFFSET $2`,
        [batchSize, batchOffset]
      );
      
      const claims = result.rows;
      console.log(`🔍 [AUDIT] Processing batch: ${claims.length} claims (offset ${batchOffset}/${totalClaims})`);
      
      if (claims.length === 0) {
        return {
          ok: true,
          message: 'No more claims to audit',
          total: totalClaims,
          processed: 0,
          verified: 0,
          failed: 0,
          notFound: 0,
          errors: 0,
          nextOffset: null
        };
      }
      
      // Create ApeChain client
      const { createPublicClient, http, defineChain } = await import('viem');
      
      const APECHAIN_MAINNET = defineChain({
        id: 33139,
        name: "ApeChain",
        nativeCurrency: { name: "APE", symbol: "APE", decimals: 18 },
        rpcUrls: { default: { http: [process.env.RPC_URL!] } },
      });
      
      const provider = createPublicClient({
        chain: APECHAIN_MAINNET,
        transport: http(process.env.RPC_URL!)
      });

      let verified = 0;
      let failed = 0;
      let notFound = 0;
      let errors = 0;

      for (const claim of claims) {
        try {
          const tx = normalizeTx(claim.tx_hash);
          if (!tx) {
            console.warn(`🔍 [AUDIT] Invalid tx_hash for claim ${claim.id}`);
            errors++;
            continue;
          }

          const receipt = await provider.getTransactionReceipt({ hash: tx as `0x${string}` });
          
          if (!receipt) {
            console.log(`🔍 [AUDIT] No receipt found for claim ${claim.id}, tx: ${tx}`);
            notFound++;
            continue;
          }

          if (receipt.status !== "success") {
            // Transaction reverted - mark claim as failed
            console.log(`🔍 [AUDIT] Claim ${claim.id} has reverted transaction, marking as failed`);
            await failClaim(claim.id);
            failed++;
          } else {
            // Transaction succeeded - keep as confirmed
            verified++;
          }
        } catch (error: any) {
          console.error(`🔍 [AUDIT] Error checking claim ${claim.id}:`, error);
          errors++;
        }
        
        // Small delay to avoid overwhelming RPC
        await new Promise(resolve => setTimeout(resolve, 50)); // Reduced to 50ms
      }

      const nextOffset = batchOffset + claims.length < totalClaims ? batchOffset + claims.length : null;

      console.log(`🔍 [AUDIT] Batch complete: ${verified} verified, ${failed} failed, ${notFound} not found, ${errors} errors`);
      console.log(`🔍 [AUDIT] Progress: ${batchOffset + claims.length}/${totalClaims} (${Math.round((batchOffset + claims.length) / totalClaims * 100)}%)`);

      return {
        ok: true,
        total: totalClaims,
        processed: claims.length,
        verified,
        failed,
        notFound,
        errors,
        nextOffset,
        progress: {
          current: batchOffset + claims.length,
          total: totalClaims,
          percent: Math.round((batchOffset + claims.length) / totalClaims * 100)
        }
      };
    } catch (e) {
      console.error(`🔍 [AUDIT] Fatal error:`, e);
      return reply.code(500).send({ ok: false, error: String(e) });
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
      let stillPending = 0;
      let notFound = 0;
      let confirmErrors = 0;
      
      // Create client for chain 33139 (ApeChain Mainnet)
      const { createPublicClient, http, defineChain } = await import('viem');
      
      const APECHAIN_MAINNET = defineChain({
        id: 33139,
        name: "ApeChain",
        nativeCurrency: { name: "APE", symbol: "APE", decimals: 18 },
        rpcUrls: { default: { http: [process.env.RPC_URL!] } },
      });
      
      const provider = createPublicClient({
        chain: APECHAIN_MAINNET,
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
            stillPending++;
            continue; // Still pending
          }
          
          // viem returns status as "success" | "reverted"
          if (receipt.status === "success") {
            console.log(`📊 [POLLER] will confirm`, {
              id: row.id,
              tx,
              statusBefore: row.status,
              chain: 33139,
            });
            
            try {
              const ok = await confirmClaimById(row.id, tx, now);
              console.log(`📊 [POLLER] confirm result`, { id: row.id, ok });
              if (ok) confirmed++;
              else confirmErrors++;
            } catch (e) {
              confirmErrors++;
              console.error(`📊 [POLLER] confirm error`, { id: row.id, err: String(e) });
            }
          } else {
            console.log(`📊 Attempting to fail claim ${row.id} - status: ${receipt.status}`);
            await failClaim(row.id);
            failed++;
            console.log(`📊 ✅ Successfully failed claim ${row.id}`);
          }
        } catch (error: any) {
          if (error?.name === "TransactionNotFoundError") {
            console.log(`📊 Transaction not found: ${row.tx_hash}`);
            notFound++;
            continue; // Still pending
          }
          console.warn(`📊 RPC error checking tx ${row.tx_hash}:`, error);
        }
      }
      
      console.log(`📊 [POLLER] batch done`, { 
        confirmed, 
        failed, 
        stillPending, 
        notFound, 
        confirmErrors,
        total: pending.length 
      });

      return { 
        ok: true, 
        message: `Processed ${pending.length} claims`,
        total: pending.length,
        confirmed,
        failed,
        stillPending,
        notFound,
        confirmErrors
      };
    } catch (error) {
      console.error('Manual poller error:', error);
      return reply.code(500).send({ error: 'Manual poller failed', details: String(error) });
    }
  });
}
