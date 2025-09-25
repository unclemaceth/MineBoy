import { Pool } from 'pg';
import { format } from 'date-fns';

async function computeDailyStats() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable not set');
  }

  const pool = new Pool({ connectionString: dbUrl });

  try {
    console.log('🔄 Computing daily stats...');

    // Get today's date in UTC
    const today = new Date();
    const dayUtc = format(today, 'yyyy-MM-dd');
    const computedAtMs = Date.now();

    // Compute stats from confirmed claims
    const result = await pool.query(`
      WITH confirmed AS (
        SELECT wallet, cartridge_id, amount_wei
        FROM claims
        WHERE status='confirmed'
      )
      SELECT
        COUNT(DISTINCT wallet) AS total_miners,
        COUNT(DISTINCT cartridge_id) AS total_carts,
        COALESCE(SUM(amount_wei::numeric), 0)::text AS total_wei_text,
        COUNT(*) AS total_claims
      FROM confirmed
    `);

    const stats = result.rows[0];
    
    // Insert or update daily stats
    await pool.query(`
      INSERT INTO daily_stats (
        day_utc, total_miners, total_carts, total_wei_text, total_claims, computed_at_ms
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (day_utc) DO UPDATE SET
        total_miners = EXCLUDED.total_miners,
        total_carts = EXCLUDED.total_carts,
        total_wei_text = EXCLUDED.total_wei_text,
        total_claims = EXCLUDED.total_claims,
        computed_at_ms = EXCLUDED.computed_at_ms
    `, [
      dayUtc,
      parseInt(stats.total_miners),
      parseInt(stats.total_carts),
      stats.total_wei_text,
      parseInt(stats.total_claims),
      computedAtMs
    ]);

    console.log('✅ Daily stats computed successfully:', {
      day: dayUtc,
      totalMiners: stats.total_miners,
      totalCarts: stats.total_carts,
      totalClaims: stats.total_claims,
      totalWei: stats.total_wei_text
    });

  } catch (error) {
    console.error('❌ Error computing daily stats:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  computeDailyStats()
    .then(() => {
      console.log('🎉 Daily stats computation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Daily stats computation failed:', error);
      process.exit(1);
    });
}

export { computeDailyStats };
