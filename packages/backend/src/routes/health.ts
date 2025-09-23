import { FastifyInstance } from 'fastify';

export async function registerHealthRoute(fastify: FastifyInstance) {
  fastify.get('/health/poller', async (_req, reply) => {
    return reply.send({ 
      ok: true, 
      message: 'Poller health check - implement lastRunAt tracking if needed',
      timestamp: new Date().toISOString()
    });
  });
}
