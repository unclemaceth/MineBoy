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

  // Check claim status counts
  fastify.get('/v2/admin/claim-stats', async (req, reply) => {
    const adminToken = process.env.ADMIN_TOKEN;
    const authHeader = req.headers.authorization;
    
    if (!adminToken || authHeader !== `Bearer ${adminToken}`) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const { getDB } = await import('../db.js');
      const db = getDB();

      const result = await db.pool.query(
        `SELECT status, COUNT(*) as count FROM claims GROUP BY status ORDER BY status`
      );

      return {
        ok: true,
        stats: result.rows
      };
    } catch (error) {
      console.error('Claim stats error:', error);
      return reply.code(500).send({ error: 'Failed to get stats', details: String(error) });
    }
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
            console.warn(`🔍 [AUDIT] Invalid tx_hash for claim ${claim.id}, marking as failed`);
            await failClaim(claim.id);
            failed++;
            continue;
          }

          let receipt;
          try {
            receipt = await provider.getTransactionReceipt({ hash: tx as `0x${string}` });
          } catch (receiptError: any) {
            // Transaction not found on ApeChain (likely Curtis testnet tx) - mark as failed
            // Log the FULL error details for debugging
            console.log(`🔍 [AUDIT] Receipt error for tx ${tx}:`, {
              message: receiptError.message,
              name: receiptError.name,
              code: receiptError.code,
              fullError: JSON.stringify(receiptError, null, 2)
            });
            
            // Check for "could not be found" (the actual RPC error message)
            if (receiptError.message?.includes('could not be found') || 
                receiptError.message?.includes('not found') || 
                receiptError.name === 'TransactionNotFoundError') {
              console.log(`🔍 [AUDIT] Transaction ${tx} not found on ApeChain (Curtis claim), marking as failed`);
              await failClaim(claim.id);
              failed++;
              continue;
            }
            console.log(`🔍 [AUDIT] Unexpected error type, re-throwing...`);
            throw receiptError; // Re-throw other errors
          }
          
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
          console.error(`🔍 [AUDIT] Error checking claim ${claim.id}:`, error.message || error);
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

  // Migrate to new season with CSV data
  fastify.post('/v2/admin/migrate-season', async (req, reply) => {
    const adminToken = process.env.ADMIN_TOKEN;
    const authHeader = req.headers.authorization;
    
    if (!adminToken || authHeader !== `Bearer ${adminToken}`) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const { csvData, seasonStartTime } = req.body as { csvData: Array<{wallet: string, amount: string}>, seasonStartTime?: string };
      
      if (!csvData || !Array.isArray(csvData)) {
        return reply.code(400).send({ error: 'csvData array required (format: [{wallet, amount}])' });
      }

      console.log(`🔄 [MIGRATE] Starting season migration with ${csvData.length} wallets`);

      const { getDB } = await import('../db.js');
      const db = getDB();

      const startTime = seasonStartTime || new Date().toISOString();

      // Create Season 4 - INDIVIDUAL
      const indivSeason = await db.pool.query(
        `INSERT INTO seasons (slug, scope, starts_at, ends_at, is_active)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (slug) DO UPDATE SET is_active = EXCLUDED.is_active
         RETURNING id`,
        ['s4-individual-2025', 'INDIVIDUAL', startTime, null, true]
      );
      const indivSeasonId = indivSeason.rows[0].id;

      // Create Season 4 - TEAM
      const teamSeason = await db.pool.query(
        `INSERT INTO seasons (slug, scope, starts_at, ends_at, is_active)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (slug) DO UPDATE SET is_active = EXCLUDED.is_active
         RETURNING id`,
        ['s4-team-2025', 'TEAM', startTime, null, true]
      );
      const teamSeasonId = teamSeason.rows[0].id;

      console.log(`🔄 [MIGRATE] Created Season 4: Individual=${indivSeasonId}, Team=${teamSeasonId}`);

      // Deactivate old seasons
      await db.pool.query(
        `UPDATE seasons SET is_active = false WHERE id NOT IN ($1, $2)`,
        [indivSeasonId, teamSeasonId]
      );

      // For each wallet, create a claim attribution
      let credited = 0;
      for (const entry of csvData) {
        const wallet = entry.wallet.toLowerCase();
        const amountWei = entry.amount;

        // Get user's team for Season 4 (if they have one)
        const teamResult = await db.pool.query(
          `SELECT team_slug FROM user_teams WHERE LOWER(wallet) = $1 AND season_id = $2`,
          [wallet, teamSeasonId]
        );
        const teamSlug = teamResult.rows[0]?.team_slug || null;

        // Create a fake claim ID for attribution
        const fakeClaimId = `migration_${wallet}_${Date.now()}`;

        // Insert into claim_team_attributions if they have a team
        if (teamSlug) {
          await db.pool.query(
            `INSERT INTO claim_team_attributions (claim_id, team_slug, season_id, wallet, amount_wei, confirmed_at)
             VALUES($1, $2, $3, $4, $5, EXTRACT(EPOCH FROM $6::timestamptz) * 1000)
             ON CONFLICT (claim_id) DO NOTHING`,
            [fakeClaimId, teamSlug, teamSeasonId, wallet, amountWei, startTime]
          );
        }

        credited++;
      }

      console.log(`🔄 [MIGRATE] Credited ${credited} wallets`);

      return {
        ok: true,
        indivSeasonId,
        teamSeasonId,
        credited,
        message: `Season 4 created and ${credited} wallets credited`
      };
    } catch (error) {
      console.error('Migration error:', error);
      return reply.code(500).send({ error: 'Migration failed', details: String(error) });
    }
  });

  // CSV-based audit: Compare database claims against a list of valid ApeChain transaction hashes
  fastify.post('/v2/admin/audit-claims-csv', async (req, reply) => {
    const adminToken = process.env.ADMIN_TOKEN;
    const authHeader = req.headers.authorization;
    
    if (!adminToken || authHeader !== `Bearer ${adminToken}`) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const { validTxHashes } = req.body as { validTxHashes: string[] };
      
      if (!validTxHashes || !Array.isArray(validTxHashes)) {
        return reply.code(400).send({ error: 'validTxHashes array required' });
      }

      console.log(`🔍 [CSV_AUDIT] Starting audit with ${validTxHashes.length} valid tx hashes`);

      // Normalize and create a Set for fast lookup
      const validTxSet = new Set(validTxHashes.map(tx => tx.toLowerCase().trim()));
      console.log(`🔍 [CSV_AUDIT] Valid tx set created with ${validTxSet.size} unique hashes`);

      // Get database connection
      const { getDB } = await import('../db.js');
      const db = getDB();

      // ONLY delete failed claims - leave confirmed ones alone
      console.log(`🔍 [CSV_AUDIT] Deleting all failed claims (Curtis testnet garbage)...`);
      const deleteResult = await db.pool.query(`DELETE FROM claims WHERE status = 'failed'`);
      console.log(`🔍 [CSV_AUDIT] Deleted ${deleteResult.rowCount} failed claims`);

      return {
        ok: true,
        deleted: deleteResult.rowCount || 0,
        message: `Deleted ${deleteResult.rowCount} failed Curtis claims`
      };
    } catch (error) {
      console.error('CSV audit error:', error);
      return reply.code(500).send({ error: 'CSV audit failed', details: String(error) });
    }
  });
}
