import { Pool } from 'pg';

const TEAMS = [
  { slug: 'geez', name: 'Geez', emoji: '😤', color: '#FF6B6B' },
  { slug: 'zards', name: 'Zards', emoji: '🦎', color: '#4ECDC4' },
  { slug: 'goobaloos', name: 'Goobaloos', emoji: '👻', color: '#45B7D1' },
  { slug: 'clutch-puppies', name: 'Clutch Puppies', emoji: '🐶', color: '#96CEB4' },
  { slug: 'foxy-fam', name: 'Foxy Fam', emoji: '🦊', color: '#FFEAA7' },
  { slug: 'monos', name: 'Monos', emoji: '🐵', color: '#DDA0DD' },
  { slug: 'alpha-dogs', name: 'Alpha Dogs', emoji: '🐕', color: '#98D8C8' },
  { slug: 'gobs', name: 'Gobs', emoji: '👹', color: '#F7DC6F' },
  { slug: 'typical-tigers', name: 'Typical Tigers', emoji: '🐅', color: '#BB8FCE' },
  { slug: 'flingers', name: 'Flingers', emoji: '💫', color: '#85C1E9' },
  { slug: 'dengs', name: 'Dengs', emoji: '🤔', color: '#F8C471' },
  { slug: 'chumps', name: 'Chumps', emoji: '😅', color: '#82E0AA' },
  { slug: 'pixl-pals', name: 'Pixl Pals', emoji: '🎮', color: '#F1948A' },
  { slug: 'doruzu-rugdollz', name: 'Doruzu/RugDollz', emoji: '🧸', color: '#D7BDE2' },
  { slug: 'froglings', name: 'Froglings', emoji: '🐸', color: '#A9DFBF' },
  { slug: 'apegames', name: 'ApeGames', emoji: '🦍', color: '#F9E79F' },
  { slug: 'eyeverse', name: 'Eyeverse', emoji: '👁️', color: '#AED6F1' },
  { slug: 'mutant-records', name: 'Mutant Records', emoji: '🎵', color: '#D5DBDB' },
  { slug: 'ovi-ovisaurs', name: 'Ovi (Ovisaurs)', emoji: '🦕', color: '#A3E4D7' },
  { slug: 'mutant-shiba-club', name: 'Mutant Shiba Club', emoji: '🐕‍🦺', color: '#FADBD8' },
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
