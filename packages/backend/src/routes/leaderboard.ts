// packages/backend/src/routes/leaderboard.ts
import { FastifyInstance } from 'fastify';
import {
  getLeaderboardTop,
  getAggregateForWallet,
  countWalletsAbove,
  type Period
} from '../db.js';

function shortAddrLast8(addr: string) {
  const a = addr ?? '';
  return a.length > 10 ? `…${a.slice(-8).toUpperCase()}` : a.toUpperCase();
}

function toAbitString(totalWei: string, decimals = 18) {
  // Convert wei to ABIT by dividing by 10^decimals
  const wei = BigInt(totalWei);
  const divisor = BigInt(10 ** decimals);
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

      const entriesRaw = getLeaderboardTop(period, limit);
      const entries = entriesRaw.map((e, i) => ({
        rank: i + 1,
        wallet: e.wallet,
        walletShort: shortAddrLast8(e.wallet),
        totalAbit: toAbitString(e.total_wei, Number(process.env.TOKEN_DECIMALS || 18))
      }));

      let me: any = null;
      if (wallet) {
        const agg = getAggregateForWallet(period, wallet);
        if (agg) {
          const above = countWalletsAbove(period, agg.total_wei);
          me = {
            rank: above + 1,
            wallet,
            walletShort: shortAddrLast8(wallet),
            totalAbit: toAbitString(agg.total_wei, Number(process.env.TOKEN_DECIMALS || 18))
          };
        } else {
          me = {
            rank: null,
            wallet,
            walletShort: shortAddrLast8(wallet),
            totalAbit: '0'
          };
        }
      }

      const pollInterval = parseInt(process.env.RECEIPT_POLL_INTERVAL_MS || '600000', 10);
      const nextUpdate = new Date(Date.now() + pollInterval);
      
      // Calculate when the last receipt poller run was (approximate)
      const lastReceiptPollerRun = new Date(Date.now() - pollInterval);
      
      console.log(`📊 Leaderboard: RECEIPT_POLL_INTERVAL_MS=${process.env.RECEIPT_POLL_INTERVAL_MS}, computed=${pollInterval}ms, nextUpdate=${nextUpdate.toISOString()}`);
      
      reply.send({ 
        period, 
        entries, 
        me,
        lastUpdated: lastReceiptPollerRun.toISOString(),
        nextUpdate: nextUpdate.toISOString()
      });
    }
  );
}
