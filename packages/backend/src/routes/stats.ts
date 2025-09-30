import { FastifyInstance } from 'fastify';
import { getDB } from '../db';

export default async function routes(app: FastifyInstance) {
  app.get('/v2/stats', async (_, reply) => {
    try {
      const db = getDB();
      
      // Get latest daily stats
      const dailyStatsResult = await db.pool.query(`
        SELECT *
        FROM daily_stats
        ORDER BY day_utc DESC
        LIMIT 1
      `);
      
      const dailyStats = dailyStatsResult.rows[0];
      
      // Compute active miners (last 10 minutes) - only new contract data
      const now = Date.now();
      const activeWindowMs = 10 * 60 * 1000; // 10 minutes
      const migrationDate = new Date('2025-09-29T15:00:53Z').getTime();
      
      // Count distinct wallets from recent ApeChain claims (last 10 minutes)
      const activeMinersResult = await db.pool.query(`
        SELECT COUNT(DISTINCT wallet) AS active_miners
        FROM claims
        WHERE status='confirmed' 
          AND confirmed_at >= $1
          AND created_at >= $2
      `, [now - activeWindowMs, migrationDate]);
      
      const activeMiners = parseInt(activeMinersResult.rows[0]?.active_miners || '0');
      
      // If no daily stats exist, compute them on-the-fly
      if (!dailyStats) {
        console.log('⚠️ No daily stats found, computing on-the-fly...');
        
        // Only show claims from after new cartridge contract deployment (Sept 29, 2025 15:00:53 UTC)
        const migrationDate = new Date('2025-09-29T15:00:53Z').getTime();
        
        const result = await db.pool.query(`
          WITH confirmed AS (
            SELECT wallet, cartridge_id, amount_wei
            FROM claims
            WHERE status='confirmed' 
              AND created_at >= $1
          )
          SELECT
            COUNT(DISTINCT wallet) AS total_miners,
            COUNT(DISTINCT cartridge_id) AS total_carts,
            COALESCE(SUM(amount_wei::numeric), 0)::text AS total_wei_text,
            COUNT(*) AS total_claims
          FROM confirmed
        `, [migrationDate]);
        
        const stats = result.rows[0];
        
        return reply.send({
          totalMiners: parseInt(stats.total_miners),
          totalCarts: parseInt(stats.total_carts),
          totalWeiText: stats.total_wei_text,
          totalClaims: parseInt(stats.total_claims),
          snapshotDayUTC: null,
          snapshotComputedAtMs: 0,
          activeMiners,
          activeWindowMs,
          computedOnFly: true
        });
      }
      
      return reply.send({
        totalMiners: parseInt(dailyStats.total_miners),
        totalCarts: parseInt(dailyStats.total_carts),
        totalWeiText: dailyStats.total_wei_text,
        totalClaims: parseInt(dailyStats.total_claims),
        snapshotDayUTC: dailyStats.day_utc,
        snapshotComputedAtMs: parseInt(dailyStats.computed_at_ms),
        activeMiners,
        activeWindowMs,
        computedOnFly: false
      });
      
    } catch (error) {
      console.error('❌ Error fetching stats:', error);
      return reply.code(500).send({ 
        error: 'Failed to fetch stats',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
