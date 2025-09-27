// packages/backend/scripts/run-seasons-migration.ts
// Run the seasons system migration

import { readFileSync } from 'fs';
import { Pool } from 'pg';

async function main() {
  try {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL environment variable not set');
    }
    
    console.log('🔄 Running seasons system migration...');
    
    const pool = new Pool({ connectionString: url });
    
    // Read the migration SQL file
    const migrationSql = readFileSync('./migrations/2025-seasons-system.sql', 'utf8');
    
    // Execute the entire migration as one block to handle DO $$ blocks properly
    console.log('📝 Executing seasons migration...');
    await pool.query(migrationSql);
    
    await pool.end();
    console.log('✅ Seasons system migration completed successfully');
    process.exit(0);
  } catch (e) {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  }
}

main();
