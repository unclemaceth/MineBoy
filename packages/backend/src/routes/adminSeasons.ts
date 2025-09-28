// packages/backend/src/routes/adminSeasons.ts
// Admin API for season management

import { FastifyInstance } from 'fastify';
import { getDB } from '../db.js';
import { ADMIN_TOKEN } from '../config.js';
import { createSeason, endActiveSeason, getSeasons, SeasonScope } from '../seasons.js';

/**
 * Admin middleware - check for valid admin token
 */
async function adminOnly(request: any, reply: any) {
  const authHeader = request.headers.authorization;
  const token = authHeader?.replace('Bearer ', '') || request.query?.token;
  
  if (token !== ADMIN_TOKEN) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

export default async function routes(app: FastifyInstance) {
  // Get all seasons or filter by scope
  app.get('/v2/admin/seasons', { preHandler: adminOnly }, async (request, reply) => {
    try {
      const { scope } = request.query as { scope?: SeasonScope };
      const db = getDB();
      const seasons = await getSeasons(db, scope);
      
      return reply.send({ seasons });
    } catch (error) {
      app.log.error('Failed to get seasons:', error);
      return reply.code(500).send({ error: 'Failed to fetch seasons' });
    }
  });

  // Create a new season (ends current active season for scope)
  app.post('/v2/admin/seasons', { preHandler: adminOnly }, async (request, reply) => {
    try {
      const { scope, slug, startsAt } = request.body as {
        scope?: SeasonScope;
        slug?: string;
        startsAt?: string;
      };
      
      if (!['TEAM', 'INDIVIDUAL'].includes(scope || '')) {
        return reply.code(400).send({ error: 'bad_scope', message: 'scope must be TEAM or INDIVIDUAL' });
      }
      
      if (!slug || typeof slug !== 'string') {
        return reply.code(400).send({ error: 'bad_slug', message: 'slug is required' });
      }

      const db = getDB();
      
      // End current active season for this scope
      await endActiveSeason(db, scope as SeasonScope);
      
      // Create new season
      const season = await createSeason(db, {
        slug,
        scope: scope as SeasonScope,
        startsAt: startsAt ? new Date(startsAt) : undefined
      });
      
      return reply.send({ ok: true, season });
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        return reply.code(409).send({ error: 'slug_exists', message: 'Season slug already exists' });
      }
      
      app.log.error('Failed to create season:', error);
      return reply.code(500).send({ error: 'Failed to create season', message: error.message });
    }
  });

  // End the active season for a scope
  app.post('/v2/admin/seasons/end', { preHandler: adminOnly }, async (request, reply) => {
    try {
      const { scope } = request.body as { scope?: SeasonScope };
      
      if (!['TEAM', 'INDIVIDUAL'].includes(scope || '')) {
        return reply.code(400).send({ error: 'bad_scope', message: 'scope must be TEAM or INDIVIDUAL' });
      }

      const db = getDB();
      await endActiveSeason(db, scope as SeasonScope);
      
      return reply.send({ ok: true, message: `Ended active ${scope} season` });
    } catch (error) {
      app.log.error('Failed to end season:', error);
      return reply.code(500).send({ error: 'Failed to end season' });
    }
  });

  // Get season status (which seasons are active)
  app.get('/v2/admin/seasons/status', { preHandler: adminOnly }, async (request, reply) => {
    try {
      const db = getDB();
      
      const teamSeason = await db.pool.query(
        `SELECT * FROM seasons WHERE scope='TEAM' AND is_active=true ORDER BY starts_at DESC LIMIT 1`
      );
      
      const individualSeason = await db.pool.query(
        `SELECT * FROM seasons WHERE scope='INDIVIDUAL' AND is_active=true ORDER BY starts_at DESC LIMIT 1`
      );
      
      return reply.send({
        active_team_season: teamSeason.rows[0] || null,
        active_individual_season: individualSeason.rows[0] || null
      });
    } catch (error) {
      app.log.error('Failed to get season status:', error);
      return reply.code(500).send({ error: 'Failed to get season status' });
    }
  });

  // Manual retro-attribution for testing
  app.post('/v2/admin/retro-attribute', { preHandler: adminOnly }, async (request, reply) => {
    try {
      const { wallet, team_slug } = request.body as { wallet?: string; team_slug?: string };
      
      if (!wallet || !team_slug) {
        return reply.code(400).send({ error: 'wallet and team_slug required' });
      }

      const db = getDB();
      const { chooseTeam } = await import('../seasons.js');
      
      // This will run retro-attribution
      const result = await chooseTeam(db, wallet, team_slug);
      
      return reply.send({
        ok: true,
        message: `Retro-attributed ${result.attributedClaims} claims for ${wallet} to team ${team_slug}`,
        attributedClaims: result.attributedClaims,
        alreadyChosen: result.alreadyChosen
      });
    } catch (error: any) {
      app.log.error('Failed to retro-attribute:', error);
      return reply.code(500).send({ error: 'Failed to retro-attribute', message: error.message });
    }
  });
}
