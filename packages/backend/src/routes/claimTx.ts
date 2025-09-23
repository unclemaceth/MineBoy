// packages/backend/src/routes/claimTx.ts
import { FastifyInstance } from 'fastify';
import { setClaimTxHash, getDB } from '../db.js';

export async function registerClaimTxRoute(fastify: FastifyInstance) {
  fastify.post<{ Body: { claimId: string; txHash: string } }>(
    '/v2/claim/tx',
    async (req, reply) => {
      try {
        const { claimId, txHash } = req.body ?? {};
        if (!claimId || !txHash) {
          return reply.code(400).send({ error: 'claimId and txHash required' });
        }

        // Ensure normalized hash (lowercase)
        const hash = txHash.toLowerCase();

        // Load claim first to check state
        const db = getDB();
        const claimStmt = db.prepare(`SELECT id, status, tx_hash FROM claims WHERE id = @claimId`);
        const claim = await claimStmt.get({ claimId });
        
        if (!claim) {
          return reply.code(404).send({ error: 'claim not found' });
        }
        if (claim.status !== 'pending') {
          return reply.code(409).send({ error: 'claim not pending' });
        }
        if (claim.tx_hash && claim.tx_hash.toLowerCase() === hash) {
          // Idempotent success
          return reply.send({ ok: true, claimId, txHash: hash, idempotent: true });
        }
        if (claim.tx_hash && claim.tx_hash.toLowerCase() !== hash) {
          return reply.code(409).send({ 
            error: 'claim already has different tx hash', 
            claimId, 
            existingTxHash: claim.tx_hash 
          });
        }

        // Attach hash
        await setClaimTxHash(claimId, hash);

        return reply.send({ ok: true, claimId, txHash: hash });
      } catch (err: any) {
        console.error('[CLAIM_TX] error', err);
        
        // Handle potential database constraint violations
        if (err?.code === '23505') {
          // Unique constraint violation - tx hash already exists
          return reply.code(409).send({ 
            error: 'tx hash already attached to another claim',
            details: err.message 
          });
        }
        
        return reply.code(500).send({ 
          error: 'internal', 
          details: err?.message || 'Unknown error' 
        });
      }
    }
  );
}
