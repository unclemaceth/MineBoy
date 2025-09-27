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
            `SELECT
               LOWER(wallet) AS wallet,
               SUM(amount_wei::numeric) AS total_wei,
               ROW_NUMBER() OVER (ORDER BY SUM(amount_wei::numeric) DESC) AS rank
             FROM claims
             WHERE status='confirmed'
               AND confirmed_at >= EXTRACT(EPOCH FROM $1::timestamptz) * 1000
               AND confirmed_at <= EXTRACT(EPOCH FROM $2::timestamptz) * 1000
               AND LOWER(wallet) = LOWER($3)
             GROUP BY LOWER(wallet)`,
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
          return reply.code(404).send({ error: 'Season not found' });
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
        fastify.log.error('Failed to get team leaderboard:', error);
        return reply.code(500).send({ error: 'Failed to fetch team leaderboard' });
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
