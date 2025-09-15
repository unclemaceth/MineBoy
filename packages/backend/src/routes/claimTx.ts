// packages/backend/src/routes/claimTx.ts
import { FastifyInstance } from 'fastify';
import { setClaimTxHash } from '../db.js';

export async function registerClaimTxRoute(fastify: FastifyInstance) {
  fastify.post<{ Body: { claimId: string; txHash: string } }>(
    '/v2/claim/tx',
    async (req, reply) => {
      const { claimId, txHash } = req.body || {};
      if (!claimId || !txHash) {
        return reply.code(400).send({ error: 'Missing claimId or txHash' });
      }
      setClaimTxHash(claimId, txHash);
      return { ok: true };
    }
  );
}
