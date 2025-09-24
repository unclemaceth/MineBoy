// packages/backend/src/routes/leaderboard.ts
import { FastifyInstance } from 'fastify';
import {
  getLeaderboardTop,
  getAggregateForWallet,
  countWalletsAbove,
  getTeamStandings,
  type Period
} from '../db.js';

function shortAddrLast8(addr: string) {
  const a = addr ?? '';
  return a.length > 10 ? `…${a.slice(-8).toUpperCase()}` : a.toUpperCase();
}

function toAbitString(totalWei: string, decimals = 18) {
  // Convert wei to ABIT by dividing by 10^decimals using pure BigInt math
  const wei = BigInt(totalWei);
  const divisor = 10n ** BigInt(decimals);   // ← exact BigInt math
  const abit = wei / divisor;
  return abit.toString();
}

export async function registerLeaderboardRoute(fastify: FastifyInstance) {
  fastify.get(
    '/v2/leaderboard',
    async (req, reply) => {
      const q: any = req.query || {};
      const period = (q.period || 'all') as Period;
      const limit = Math.min(parseInt(q.limit || '25', 10), 100);
      const wallet = (q.wallet as string | undefined) || undefined;

      const entriesRaw = await getLeaderboardTop(period, limit);
      const entries = entriesRaw.map((e, i) => ({
        rank: i + 1,
        wallet: e.wallet,
        walletShort: shortAddrLast8(e.wallet),
        totalABIT: toAbitString(e.total_wei, Number(process.env.TOKEN_DECIMALS || 18)),
        team_slug: e.team_slug ?? undefined,
        team_name: e.team_name ?? undefined,
        team_emoji: e.team_emoji ?? undefined,
        team_color: e.team_color ?? undefined,
      }));

      let me: any = null;
      if (wallet) {
        const agg = await getAggregateForWallet(period, wallet);
        if (agg) {
          const above = await countWalletsAbove(period, agg.total_wei);
          me = {
            rank: above + 1,
            wallet,
            walletShort: shortAddrLast8(wallet),
            totalABIT: toAbitString(agg.total_wei, Number(process.env.TOKEN_DECIMALS || 18))
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

      const pollInterval = parseInt(process.env.RECEIPT_POLL_INTERVAL_MS || '600000', 10);
      
      // Calculate next exact 10-minute mark
      const now = new Date();
      const minutes = now.getMinutes();
      const nextMinute = Math.ceil(minutes / 10) * 10;
      const nextUpdate = new Date(now);
      
      if (nextMinute >= 60) {
        nextUpdate.setHours(nextUpdate.getHours() + 1);
        nextUpdate.setMinutes(0);
      } else {
        nextUpdate.setMinutes(nextMinute);
      }
      nextUpdate.setSeconds(0);
      nextUpdate.setMilliseconds(0);
      
      // Calculate when the last receipt poller run was (exact 10-minute mark)
      const lastReceiptPollerRun = new Date(nextUpdate.getTime() - pollInterval);
      
      console.log(`📊 Leaderboard: RECEIPT_POLL_INTERVAL_MS=${process.env.RECEIPT_POLL_INTERVAL_MS}, computed=${pollInterval}ms, nextUpdate=${nextUpdate.toISOString()}`);
      
      const payload = { 
        period, 
        entries, 
        me,
        lastUpdated: lastReceiptPollerRun.toISOString(),
        nextUpdate: nextUpdate.toISOString()
      };
      
      // Cache for 15 seconds with 60s stale-while-revalidate
      reply.header('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
      reply.send(payload);
    }
  );

  // Team standings endpoint
  fastify.get(
    '/v2/leaderboard/teams',
    async (req, reply) => {
      try {
        const q: any = req.query || {};
        const period = (q.period || 'all') as Period;
        
        const { getDB } = await import('../db.js');
        const db = getDB();
        const standings = await getTeamStandings(db, period);
        
        // Convert scores to ABIT strings
        const standingsWithABIT = standings.map(standing => ({
          ...standing,
          total_score: toAbitString(standing.total_score.toString(), Number(process.env.TOKEN_DECIMALS || 18))
        }));
        
        // Cache for 15 seconds with 60s stale-while-revalidate
        reply.header('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
        reply.send(standingsWithABIT);
      } catch (error) {
        fastify.log.error('Failed to get team standings:', error);
        return reply.code(500).send({ error: 'Failed to fetch team standings' });
      }
    }
  );

  // Debug endpoint to test team data fetching
  fastify.get(
    '/v2/debug/leaderboard-teams',
    async (req, reply) => {
      try {
        const { getDB } = await import('../db.js');
        const db = getDB();
        
        // Test getCurrentSeasonId
        const { getCurrentSeasonId } = await import('../db.js');
        const seasonId = await getCurrentSeasonId(db);
        
        // Test team query for a specific wallet
        const testWallet = '0x909102dbf4a1bc248bc5f9eedad589e7552ad164';
        const teamStmt = await db.pool.query(
          `SELECT ut.wallet, t.slug, t.name, t.emoji, t.color
           FROM user_teams ut
           JOIN teams t ON t.id = ut.team_id
           WHERE ut.wallet = $1 AND ut.season_id = $2`,
          [testWallet, seasonId]
        );
        
        return reply.send({
          seasonId,
          testWallet,
          teamQueryResult: teamStmt.rows,
          seasonSlug: process.env.SEASON_SLUG
        });
      } catch (error) {
        fastify.log.error('Debug endpoint error:', error);
        return reply.code(500).send({ 
          error: 'Debug endpoint failed',
          details: error.message
        });
      }
    }
  );
}
