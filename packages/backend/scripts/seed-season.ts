import { Pool } from 'pg';

const SLUG = process.env.SEASON_SLUG || 's1-2025';

async function main() {
  try {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL environment variable not set');
    }
    
    const pool = new Pool({ connectionString: url });
    
    await pool.query(
      `INSERT INTO seasons (slug) VALUES ($1)
       ON CONFLICT (slug) DO NOTHING`,
      [SLUG]
    );
    
    await pool.end();
    console.log(`✅ Season seeded: ${SLUG}`);
    process.exit(0);
  } catch (e) {
    console.error('❌ Season seeding failed:', e);
    process.exit(1);
  }
}

main();
