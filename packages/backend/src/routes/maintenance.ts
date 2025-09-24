// packages/backend/src/routes/maintenance.ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

type MaintConfig = {
  enabled: boolean;
  message?: string;
  untilIso?: string | null;
};

// in-memory flag; initializes from env once on boot
const state: MaintConfig = {
  enabled: process.env.MAINTENANCE_MODE === 'true',
  message: process.env.MAINTENANCE_MESSAGE || 'We\'re shipping an update.',
  untilIso: process.env.MAINTENANCE_UNTIL || null,
};

// allowlist that must never be blocked
const BYPASS = [
  // health & metrics
  '/health', '/ready', '/live',
  // admin
  '/v2/admin', // prefix match
  // debugging (if you keep them)
  '/v2/debug',
  // maintenance status (needed for frontend)
  '/v2/maintenance',
];

function isBypassed(path: string) {
  return BYPASS.some(p => path === p || path.startsWith(p + '/'));
}

export async function registerMaintenance(fastify: FastifyInstance) {
  // status endpoint (frontend can poll this)
  fastify.get('/v2/maintenance', async (_req, reply) => {
    return reply.send({ ...state });
  });

  // admin toggles (guard with ADMIN_TOKEN)
  fastify.post('/v2/admin/maintenance/on', async (req, reply) => {
    const token = (req.headers['x-admin-token'] || req.headers['authorization'] || '') as string;
    if (!token || !token.includes(process.env.ADMIN_TOKEN || '')) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    const body = (req.body || {}) as Partial<MaintConfig>;
    state.enabled = true;
    if (typeof body.message === 'string') state.message = body.message;
    state.untilIso = typeof body.untilIso === 'string' ? body.untilIso : null;
    return reply.send({ ok: true, ...state });
  });

  fastify.post('/v2/admin/maintenance/off', async (req, reply) => {
    const token = (req.headers['x-admin-token'] || req.headers['authorization'] || '') as string;
    if (!token || !token.includes(process.env.ADMIN_TOKEN || '')) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    state.enabled = false;
    return reply.send({ ok: true, ...state });
  });

  // global gate — runs before route handlers
  fastify.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    // let CORS preflights pass
    if (req.method === 'OPTIONS') return;
    if (!state.enabled) return;
    if (isBypassed(req.url)) return;

    reply
      .code(503)
      .header('Retry-After', '120')
      .send({
        error: 'maintenance',
        message: state.message,
        untilIso: state.untilIso,
      });
  });
}