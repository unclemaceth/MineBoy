// packages/backend/src/routes/leaderboardSeasons.ts
// Season-based leaderboard routes for TEAM and INDIVIDUAL seasons

import { FastifyInstance } from 'fastify';
import { getDB } from '../db.js';
import { getActiveSeason, getSeasonBySlug, getIndividualLeaderboard, getTeamLeaderboard } from '../seasons.js';

function shortAddrLast8(addr: string) {
  const a = addr ?? '';
  return a.length > 10 ? `…${a.slice(-5).toUpperCase()}` : a.toUpperCase();
}

function toAbitString(totalWei: string, decimals = 18) {
  // Convert wei to ABIT by dividing by 10^decimals using pure BigInt math
  const wei = BigInt(totalWei);
  const divisor = 10n ** BigInt(decimals);   // ← exact BigInt math
  const abit = wei / divisor;
  return abit.toString();
}

export async function registerSeasonLeaderboardRoute(fastify: FastifyInstance) {
  // Individual leaderboard for a season
  fastify.get(
    '/v2/leaderboard/individual',
    async (req, reply) => {
      try {
        const q: any = req.query || {};
        const seasonParam = q.season || 'active';
        const limit = Math.min(parseInt(q.limit || '25', 10), 100);
        const offset = parseInt(q.offset || '0', 10);
        const wallet = q.wallet as string | undefined;

        const db = getDB();
        
        // Get season
        const season = seasonParam === 'active' 
          ? await getActiveSeason(db, 'INDIVIDUAL')
          : await getSeasonBySlug(db, seasonParam);
          
        if (!season) {
          return reply.code(404).send({ error: 'Season not found' });
        }

        // Get leaderboard entries
        const entriesRaw = await getIndividualLeaderboard(db, season, limit, offset);
        
        // Get arcade names for top entries
        const wallets = entriesRaw.map(e => e.wallet);
        const arcadeNames = wallets.length > 0 ? await db.pool.query(
          `SELECT LOWER(wallet) as wallet, name as arcade_name FROM user_names WHERE LOWER(wallet) = ANY($1)`,
          [wallets]
        ) : { rows: [] };
        
        const nameMap = new Map(arcadeNames.rows.map(r => [r.wallet, r.arcade_name]));

        const entries = entriesRaw.map(e => ({
          rank: e.rank,
          wallet: e.wallet,
          walletShort: shortAddrLast8(e.wallet),
          totalABIT: toAbitString(e.total_wei, Number(process.env.TOKEN_DECIMALS || 18)),
          arcade_name: nameMap.get(e.wallet.toLowerCase()) ?? undefined,
        }));

        // Get user's rank if wallet provided
        let me: any = null;
        if (wallet) {
          const userRankResult = await db.pool.query(
            `WITH cleaned AS (
               SELECT LOWER(wallet) AS wallet, NULLIF(amount_wei::text, '')::numeric AS amt
               FROM claims
               WHERE status='confirmed'
                 AND confirmed_at >= EXTRACT(EPOCH FROM $1::timestamptz) * 1000
                 AND confirmed_at <= EXTRACT(EPOCH FROM $2::timestamptz) * 1000
                 AND LOWER(wallet) = LOWER($3)
             )
             SELECT
               wallet,
               COALESCE(SUM(amt), 0) AS total_wei,
               ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(amt), 0) DESC) AS rank
             FROM cleaned
             GROUP BY wallet`,
            [season.starts_at, season.ends_at || new Date().toISOString(), wallet]
          );

          if (userRankResult.rows[0]) {
            const userRow = userRankResult.rows[0];
            const userArcadeName = await db.pool.query(
              `SELECT name as arcade_name FROM user_names WHERE LOWER(wallet) = LOWER($1)`,
              [wallet]
            );
            
            me = {
              rank: parseInt(userRow.rank),
              wallet,
              walletShort: shortAddrLast8(wallet),
              totalABIT: toAbitString(userRow.total_wei, Number(process.env.TOKEN_DECIMALS || 18)),
              arcade_name: userArcadeName.rows[0]?.arcade_name ?? undefined,
            };
          } else {
            me = {
              rank: null,
              wallet,
              walletShort: shortAddrLast8(wallet),
              totalABIT: '0'
            };
          }
        }

        const payload = {
          season: {
            id: season.id,
            slug: season.slug,
            scope: season.scope,
            starts_at: season.starts_at,
            ends_at: season.ends_at,
            is_active: season.is_active
          },
          entries,
          me,
          lastUpdated: new Date().toISOString(),
          nextUpdate: new Date(Date.now() + 60000).toISOString() // 1 minute from now
        };

        // Cache for 15 seconds with 60s stale-while-revalidate
        reply.header('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
        reply.send(payload);
      } catch (error) {
        fastify.log.error('Failed to get individual leaderboard:', error);
        return reply.code(500).send({ error: 'Failed to fetch individual leaderboard' });
      }
    }
  );

  // Team leaderboard for a season
  fastify.get(
    '/v2/leaderboard/team',
    async (req, reply) => {
      try {
        const q: any = req.query || {};
        const seasonParam = q.season || 'active';

        const db = getDB();
        
        // Get season
        const season = seasonParam === 'active' 
          ? await getActiveSeason(db, 'TEAM')
          : await getSeasonBySlug(db, seasonParam);
          
        if (!season) {
          return reply.code(200).send({ season: null, entries: [] });
        }

        // Get team leaderboard entries
        const entriesRaw = await getTeamLeaderboard(db, season);
        
        // Get team details
        const teamSlugs = entriesRaw.map(e => e.team_slug);
        const teamDetails = teamSlugs.length > 0 ? await db.pool.query(
          `SELECT slug, name, emoji, color FROM teams WHERE slug = ANY($1) AND is_active=true`,
          [teamSlugs]
        ) : { rows: [] };
        
        const teamMap = new Map(teamDetails.rows.map(t => [t.slug, t]));

        const entries = entriesRaw.map(e => {
          const team = teamMap.get(e.team_slug);
          return {
            rank: e.rank,
            team_slug: e.team_slug,
            name: team?.name || e.team_slug,
            emoji: team?.emoji,
            color: team?.color,
            members: e.members,
            totalABIT: toAbitString(e.total_wei, Number(process.env.TOKEN_DECIMALS || 18)),
          };
        });

        const payload = {
          season: {
            id: season.id,
            slug: season.slug,
            scope: season.scope,
            starts_at: season.starts_at,
            ends_at: season.ends_at,
            is_active: season.is_active
          },
          entries,
          lastUpdated: new Date().toISOString(),
          nextUpdate: new Date(Date.now() + 60000).toISOString() // 1 minute from now
        };

        // Cache for 15 seconds with 60s stale-while-revalidate
        reply.header('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
        reply.send(payload);
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get team leaderboard');
        return reply.code(500).send({ ok: false, error: 'internal_error' });
      }
    }
  );

  // Get active season for a scope
  fastify.get(
    '/v2/seasons/active',
    async (req, reply) => {
      try {
        const q: any = req.query || {};
        const scope = q.scope as 'TEAM' | 'INDIVIDUAL';
        
        if (!scope || !['TEAM', 'INDIVIDUAL'].includes(scope)) {
          return reply.code(400).send({ error: 'scope parameter required (TEAM or INDIVIDUAL)' });
        }

        const db = getDB();
        const season = await getActiveSeason(db, scope);
        
        if (!season) {
          return reply.code(200).send({ season: null });
        }
        
        return reply.send({ season });
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get active season');
        return reply.code(500).send({ error: 'Failed to fetch active season' });
      }
    }
  );

  // Get team members for a specific team
  fastify.get(
    '/v2/team/members',
    async (req, reply) => {
      try {
        const q: any = req.query || {};
        const seasonParam = q.season || 'active';
        const teamSlug = q.team;

        if (!teamSlug) {
          return reply.code(400).send({ error: 'team parameter required' });
        }

        const db = getDB();
        
        // Get season
        const season = seasonParam === 'active' 
          ? await getActiveSeason(db, 'TEAM')
          : await getSeasonBySlug(db, seasonParam);
          
        if (!season) {
          return reply.code(200).send({ season: null, team: null, members: [] });
        }

        // Get team members with their ABIT totals
        const membersResult = await db.pool.query(
          `WITH mem AS (
             SELECT wallet, created_at AS joined_at
             FROM user_teams
             WHERE season_id = $1 AND team_slug = $2
           ),
           agg AS (
             SELECT wallet, COALESCE(SUM(NULLIF(amount_wei::text,'')::numeric),0) AS total_wei
             FROM claim_team_attributions
             WHERE season_id = $1 AND team_slug = $2
             GROUP BY wallet
           ),
           names AS (
             SELECT wallet, name AS arcade_name
             FROM user_names
           )
           SELECT m.wallet,
                  n.arcade_name,
                  m.joined_at,
                  COALESCE(a.total_wei,0) AS total_wei
           FROM mem m
           LEFT JOIN agg a USING(wallet)
           LEFT JOIN names n USING(wallet)
           ORDER BY a.total_wei DESC NULLS LAST, m.joined_at ASC`,
          [season.id, teamSlug]
        );

        const members = membersResult.rows.map(row => ({
          wallet: row.wallet,
          arcade_name: row.arcade_name || null,
          joined_at: row.joined_at,
          total_wei: row.total_wei.toString()
        }));

        const payload = {
          season: {
            id: season.id,
            slug: season.slug,
            scope: season.scope,
            starts_at: season.starts_at,
            ends_at: season.ends_at,
            is_active: season.is_active
          },
          team: {
            slug: teamSlug,
            name: teamSlug, // fallback to slug
            emoji: null
          },
          members,
          lastUpdated: new Date().toISOString()
        };

        reply.send(payload);
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get team members');
        return reply.code(500).send({ ok: false, error: 'internal_error' });
      }
    }
  );

  // Get seasons list
  fastify.get(
    '/v2/seasons',
    async (req, reply) => {
      try {
        const q: any = req.query || {};
        const scope = q.scope; // 'TEAM' or 'INDIVIDUAL' or undefined for all

        const db = getDB();
        
        let query = `SELECT * FROM seasons`;
        let params: any[] = [];
        
        if (scope && ['TEAM', 'INDIVIDUAL'].includes(scope)) {
          query += ` WHERE scope=$1`;
          params.push(scope);
        }
        
        query += ` ORDER BY starts_at DESC`;
        
        const result = await db.pool.query(query, params);
        
        return reply.send({ seasons: result.rows });
      } catch (error) {
        fastify.log.error('Failed to get seasons:', error);
        return reply.code(500).send({ error: 'Failed to fetch seasons' });
      }
    }
  );
}
