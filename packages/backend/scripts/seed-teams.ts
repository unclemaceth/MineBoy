import { Pool } from 'pg';

const TEAMS = [
  { slug: 'red-rockets', name: 'Red Rockets', emoji: '🚀', color: '#FF5555' },
  { slug: 'green-miners', name: 'Green Miners', emoji: '⛏️', color: '#64ff8a' },
  { slug: 'blue-bytes',   name: 'Blue Bytes',   emoji: '🔷', color: '#5E8BFF' },
];

async function main() {
  try {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL environment variable not set');
    }
    
    const pool = new Pool({ connectionString: url });
    
    for (const t of TEAMS) {
      await pool.query(
        `INSERT INTO teams (slug,name,emoji,color,is_active)
         VALUES ($1,$2,$3,$4,true)
         ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, emoji=EXCLUDED.emoji, color=EXCLUDED.color`,
        [t.slug, t.name, t.emoji, t.color]
      );
      console.log(`✅ Seeded team: ${t.emoji} ${t.name}`);
    }
    
    await pool.end();
    console.log('✅ All teams seeded successfully');
    process.exit(0);
  } catch (e) {
    console.error('❌ Team seeding failed:', e);
    process.exit(1);
  }
}

main();
