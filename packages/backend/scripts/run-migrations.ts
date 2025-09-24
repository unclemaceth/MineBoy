import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

async function main() {
  try {
    // Initialize database connection
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL environment variable not set');
    }
    
    const pool = new Pool({ connectionString: url });
    const file = path.resolve(process.cwd(), 'packages/backend/migrations/2025-teams.sql');
    const sql = fs.readFileSync(file, 'utf8');
    
    // For PostgreSQL, we need to execute each statement separately
    const statements = sql.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        await pool.query(statement.trim());
        console.log(`✅ Executed: ${statement.trim().substring(0, 50)}...`);
      }
    }
    
    await pool.end();
    console.log('✅ Migrations applied successfully');
    process.exit(0);
  } catch (e) {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  }
}

main();
