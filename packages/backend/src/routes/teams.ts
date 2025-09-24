import { FastifyInstance } from 'fastify';
import { getDB } from '../db.js';
import { getCurrentSeasonId, listTeams, getUserTeam, setUserTeam } from '../db.js';

export default async function routes(app: FastifyInstance) {
  app.get('/v2/teams', async (_, reply) => {
    try {
      const db = getDB();
      const teams = await listTeams(db);
      return reply.send(teams);
    } catch (error) {
      app.log.error('Failed to list teams:', error);
      return reply.code(500).send({ error: 'Failed to fetch teams' });
    }
  });

  app.get('/v2/user/team', async (req, reply) => {
    try {
      const wallet = (req.query as any).wallet as string;
      if (!wallet) {
        return reply.code(400).send({ error: 'wallet query parameter required' });
      }
      
      const db = getDB();
      const seasonId = await getCurrentSeasonId(db);
      const team = await getUserTeam(db, wallet, seasonId);
      
      return reply.send({ team });
    } catch (error) {
      app.log.error('Failed to get user team:', error);
      return reply.code(500).send({ error: 'Failed to fetch user team' });
    }
  });

  app.post('/v2/user/team', async (req, reply) => {
    try {
      const { wallet, teamSlug } = req.body as { wallet?: string; teamSlug?: string };
      
      if (!wallet || !teamSlug) {
        return reply.code(400).send({ error: 'wallet and teamSlug required in request body' });
      }
      
      const db = getDB();
      const seasonId = await getCurrentSeasonId(db);
      
      await setUserTeam(db, wallet, seasonId, teamSlug);
      const team = await getUserTeam(db, wallet, seasonId);
      
      return reply.send({ ok: true, team });
    } catch (error) {
      app.log.error('Failed to set user team:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.code(404).send({ error: error.message });
      }
      return reply.code(500).send({ error: 'Failed to set user team' });
    }
  });
}
