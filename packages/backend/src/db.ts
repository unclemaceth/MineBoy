// packages/backend/src/db.ts
import Database from 'better-sqlite3';
import { Pool, Client } from 'pg';

export type ClaimRow = {
  id: string;                 // e.g. `${sessionId}:${jobId}` or ULID
  wallet: string;             // checksummed 0x...
  cartridge_id: number;       // ERC721 tokenId (integer)
  hash: string;               // mined hash (0x...)
  amount_wei: string;         // as decimal string (exact)
  tx_hash?: string | null;    // set when wallet broadcasts
  status: 'pending' | 'confirmed' | 'failed' | 'expired';
  created_at: number;         // epoch ms
  confirmed_at?: number | null;
  pending_expires_at?: number | null;
};

let db: Database.Database | null = null;
let pgPool: Pool | null = null;

export async function initDb(dbUrl?: string) {
  const url = dbUrl || process.env.DATABASE_URL;
  
  if (url && url.startsWith('postgresql://')) {
    // Use PostgreSQL
    pgPool = new Pool({ connectionString: url });
    console.log('📊 Using PostgreSQL database');
    
    // PostgreSQL table creation
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS claims (
        id TEXT PRIMARY KEY,
        wallet TEXT NOT NULL,
        cartridge_id INTEGER NOT NULL,
        hash TEXT NOT NULL,
        amount_wei TEXT NOT NULL,
        tx_hash TEXT,
        status TEXT NOT NULL CHECK(status IN ('pending','confirmed','failed','expired')),
        created_at BIGINT NOT NULL,
        confirmed_at BIGINT,
        pending_expires_at BIGINT
      );
    `);
            await pgPool.query(`CREATE INDEX IF NOT EXISTS ix_claims_wallet ON claims(wallet);`);
            await pgPool.query(`CREATE INDEX IF NOT EXISTS ix_claims_status ON claims(status);`);
            await pgPool.query(`CREATE INDEX IF NOT EXISTS ix_claims_created ON claims(created_at);`);
            await pgPool.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_claims_wallet_hash ON claims(wallet, hash);`);
            await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_claims_pending_tx ON claims (status, tx_hash) WHERE status IN ('pending','tx_submitted') AND tx_hash IS NOT NULL;`);
            await pgPool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_claims_tx_hash_live ON claims (lower(tx_hash)) WHERE tx_hash IS NOT NULL AND status IN ('pending','confirmed');`);
  } else {
    // Use SQLite
    const file = url?.startsWith('file:') ? url.replace('file:', '') : (url || 'minerboy.db');
    db = new Database(file);
    db.pragma('journal_mode = WAL');
    console.log('📊 Using SQLite database:', file);
    
    // SQLite table creation
    db.exec(`
      CREATE TABLE IF NOT EXISTS claims (
        id TEXT PRIMARY KEY,
        wallet TEXT NOT NULL,
        cartridge_id INTEGER NOT NULL,
        hash TEXT NOT NULL,
        amount_wei TEXT NOT NULL,
        tx_hash TEXT,
        status TEXT NOT NULL CHECK(status IN ('pending','confirmed','failed','expired')),
        created_at INTEGER NOT NULL,
        confirmed_at INTEGER,
        pending_expires_at INTEGER
      );
    `);
            db.exec(`CREATE INDEX IF NOT EXISTS ix_claims_wallet ON claims(wallet);`);
            db.exec(`CREATE INDEX IF NOT EXISTS ix_claims_status ON claims(status);`);
            db.exec(`CREATE INDEX IF NOT EXISTS ix_claims_created ON claims(created_at);`);
            db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_claims_wallet_hash ON claims(wallet, hash);`);
            db.exec(`CREATE INDEX IF NOT EXISTS idx_claims_pending_tx ON claims (status, tx_hash) WHERE status IN ('pending','tx_submitted') AND tx_hash IS NOT NULL;`);
            db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uq_claims_tx_hash_live ON claims (tx_hash) WHERE tx_hash IS NOT NULL;`);
  }
}

// Create a PostgreSQL adapter that mimics SQLite interface
class PostgreSQLAdapter {
  constructor(private pool: Pool) {}

  prepare(query: string) {
    // 1) Collect parameter names in first-occurrence order from the ORIGINAL query
    const paramNames: string[] = [];
    const seen = new Set<string>();
    const paramRegex = /@(\w+)/g;
    let m: RegExpExecArray | null;
    while ((m = paramRegex.exec(query)) !== null) {
      const name = m[1];
      if (!seen.has(name)) {
        seen.add(name);
        paramNames.push(name);
      }
    }

    // 2) Rewrite the SQL by replacing @name with $<position> consistent with paramNames
    const nameToIndex = new Map<string, number>();
    paramNames.forEach((n, i) => nameToIndex.set(n, i + 1));
    const pgQuery = query
      .replace(/INSERT OR IGNORE/g, 'INSERT')
      .replace(/@(\w+)/g, (_match, name) => {
        const idx = nameToIndex.get(name);
        if (!idx) throw new Error(`Unknown SQL param @${name} in query`);
        return `$${idx}`;
      })
      .replace(/ON CONFLICT \(id\) DO NOTHING/g, 'ON CONFLICT (id) DO NOTHING');

    const paramsToArray = (params: any): any[] => {
      if (Array.isArray(params)) return params;
      if (!params) return [];
      return paramNames.map((name) => params[name]);
    };

    return {
      run: async (params?: any) => {
        const arr = paramsToArray(params);
        await this.pool.query(pgQuery, arr);
        return { changes: 1 }; // mimic better-sqlite3
      },
      get: async (params?: any) => {
        const arr = paramsToArray(params);
        const result = await this.pool.query(pgQuery, arr);
        return result.rows[0] || null;
      },
      all: async (params?: any) => {
        const arr = paramsToArray(params);
        const result = await this.pool.query(pgQuery, arr);
        return result.rows;
      }
    };
  }

  exec(query: string) {
    // fire-and-forget is fine for DDL in your boot flow
    this.pool.query(query);
  }
}

export function getDB() {
  if (pgPool) return new PostgreSQLAdapter(pgPool);
  if (!db) throw new Error('DB not initialized. Call initDb() in server boot.');
  return db;
}

export function insertPendingClaim(row: ClaimRow) {
  const d = getDB();
  const stmt = d.prepare(`
    INSERT OR IGNORE INTO claims
      (id, wallet, cartridge_id, hash, amount_wei, tx_hash, status, created_at, confirmed_at, pending_expires_at)
    VALUES
      (@id, @wallet, @cartridge_id, @hash, @amount_wei, @tx_hash, @status, @created_at, @confirmed_at, @pending_expires_at)
  `);
  stmt.run(row);
}

export async function setClaimTxHash(claimId: string, txHash: string) {
  const d = getDB();
  const stmt = d.prepare(`
    UPDATE claims
       SET tx_hash=@txHash
     WHERE id=@claimId
       AND status='pending'
       AND (tx_hash IS NULL OR tx_hash = @txHash)
  `);
  return await stmt.run({ claimId, txHash });
}

export async function confirmClaimById(claimId: string, txHash: string, confirmedAt: number): Promise<boolean> {
  const d = getDB();
  const stmt = d.prepare(`
    UPDATE claims
       SET status='confirmed', tx_hash=COALESCE(tx_hash, @txHash), confirmed_at=@confirmedAt
     WHERE id=@claimId AND status='pending'
  `);
  const result = await stmt.run({ claimId, txHash, confirmedAt: confirmedAt }); // ← await
  
  if (result.changes === 0) {
    console.warn(`[CONFIRM] no row updated (status mismatch?)`, { claimId });
    return false;
  }
  
  console.log(`[CONFIRM] updated claim`, { claimId, changes: result.changes });
  return true;
}

export async function failClaim(claimId: string) {
  const d = getDB();
  const stmt = d.prepare(`UPDATE claims SET status='failed' WHERE id=@claimId AND status='pending'`);
  await stmt.run({ claimId }); // ← await
}

export async function expireStalePending(now: number) {
  const d = getDB();
  const stmt = d.prepare(`
    UPDATE claims SET status='expired'
    WHERE status='pending' AND pending_expires_at IS NOT NULL AND pending_expires_at < @now
  `);
  await stmt.run({ now }); // ← await
}

export async function listPendingWithTx(): Promise<ClaimRow[]> {
  const d = getDB();
  const stmt = d.prepare(`
    SELECT *
    FROM claims
    WHERE status='pending' 
      AND tx_hash IS NOT NULL 
      AND length(tx_hash) = 66
      AND tx_hash LIKE '0x%'
  `);
  const rows = await stmt.all({});  // ← await
  return rows as ClaimRow[];
}

// ---- Aggregation for leaderboard ----

export type Period = 'all' | '24h' | '7d';

function sinceForPeriod(period: Period): number {
  const now = Date.now();
  if (period === '24h') return now - 24 * 3600_000;
  if (period === '7d') return now - 7 * 24 * 3600_000;
  return 0; // all-time
}

export type LeaderboardEntry = {
  wallet: string;
  total_wei: string;        // as string
  claims: number;
  cartridges: number;
  last_confirmed_at: number | null;
  team_slug?: string;
  team_name?: string;
  team_emoji?: string;
  team_color?: string;
};

export async function getLeaderboardTop(period: Period, limit = 25): Promise<LeaderboardEntry[]> {
  const d = getDB();
  const since = sinceForPeriod(period);
  
  // Get all confirmed claims for the period
  const claimsResult = await d.pool.query(`
    SELECT wallet, amount_wei, confirmed_at, cartridge_id
    FROM claims
    WHERE status='confirmed' AND ($1=0 OR confirmed_at >= $1)
  `, [since]);
  const claims = claimsResult.rows as Array<{
    wallet: string;
    amount_wei: string;
    confirmed_at: number;
    cartridge_id: number;
  }>;
  
  // Group by wallet and sum manually to avoid SQLite integer overflow
  const walletTotals = new Map<string, {
    total_wei: bigint;
    claims: number;
    cartridges: Set<number>;
    last_confirmed_at: number;
    canonicalWallet: string;
  }>();
  
  for (const claim of claims) {
    // Use lowercase for consistent grouping
    const walletKey = claim.wallet.toLowerCase();
    const existing = walletTotals.get(walletKey) || {
      total_wei: 0n,
      claims: 0,
      cartridges: new Set<number>(),
      last_confirmed_at: 0,
      canonicalWallet: walletKey // Store canonical form
    };
    
    existing.total_wei += BigInt(claim.amount_wei);
    existing.claims += 1;
    existing.cartridges.add(claim.cartridge_id);
    existing.last_confirmed_at = Math.max(existing.last_confirmed_at, claim.confirmed_at);
    
    walletTotals.set(walletKey, existing);
  }
  
  // Convert to array and sort
  const results = Array.from(walletTotals.entries()).map(([wallet, data]) => ({
    wallet: data.canonicalWallet,
    total_wei: data.total_wei.toString(),
    claims: data.claims,
    cartridges: data.cartridges.size,
    last_confirmed_at: data.last_confirmed_at
  }));
  
  // Sort by total_wei descending, then by last_confirmed_at ascending
  results.sort((a, b) => {
    const aWei = BigInt(a.total_wei);
    const bWei = BigInt(b.total_wei);
    if (aWei > bWei) return -1;
    if (aWei < bWei) return 1;
    return a.last_confirmed_at - b.last_confirmed_at;
  });
  
  // Get team data for the top wallets
  try {
    const seasonId = await getCurrentSeasonId(d);
    console.log('[getLeaderboardTop] results.length:', results.length, 'limit:', limit);
    console.log('[getLeaderboardTop] results.slice(0, limit).length:', results.slice(0, limit).length);
    const topWallets = results.slice(0, limit).map(r => r.wallet.toLowerCase());
    
    console.log('[getLeaderboardTop] seasonId:', seasonId);
    console.log('[getLeaderboardTop] topWallets:', topWallets.slice(0, 3));
    
    let teamData = new Map<string, { slug: string; name: string; emoji?: string; color?: string }>();
    
    if (topWallets.length > 0) {
      const { rows } = await d.pool.query(
        `SELECT ut.wallet, t.slug, t.name, t.emoji, t.color
         FROM user_teams ut
         JOIN teams t ON t.id = ut.team_id
         WHERE ut.season_id = $1
           AND ut.wallet = ANY($2::text[])`,
        [seasonId, topWallets]
      );
      
      console.log('[getLeaderboardTop] team query result:', rows.length, 'teams found');
      
      for (const row of rows) {
        teamData.set(String(row.wallet).toLowerCase(), {
          slug: row.slug,
          name: row.name,
          emoji: row.emoji,
          color: row.color
        });
      }
    }
    
    const finalResults = results.slice(0, limit).map(result => {
      const team = teamData.get(result.wallet.toLowerCase());
      console.log(`[getLeaderboardTop] wallet: ${result.wallet.toLowerCase()}, team:`, team);
      return {
        ...result,
        team_slug: team?.slug,
        team_name: team?.name,
        team_emoji: team?.emoji,
        team_color: team?.color
      };
    });
    
    console.log('[getLeaderboardTop] returning', finalResults.length, 'entries, first has team:', !!finalResults[0]?.team_slug);
    console.log('[getLeaderboardTop] sample entry:', JSON.stringify(finalResults[0], null, 2));
    return finalResults;
    
  } catch (error) {
    console.error('[getLeaderboardTop] Error fetching team data:', error);
    // Return results without team data if there's an error
    return results.slice(0, limit);
  }
}

export async function getAggregateForWallet(period: Period, wallet: string): Promise<LeaderboardEntry | null> {
  const d = getDB();
  const since = sinceForPeriod(period);
  const stmt = d.prepare(`
    SELECT amount_wei, confirmed_at, cartridge_id
    FROM claims
    WHERE status='confirmed' AND lower(wallet)=lower(@wallet) AND (@since=0 OR confirmed_at >= @since)
  `);
  const claims = await stmt.all({ wallet, since }) as Array<{
    amount_wei: string;
    confirmed_at: number;
    cartridge_id: number;
  }>;
  
  if (claims.length === 0) return null;
  
  let total_wei = 0n;
  const cartridges = new Set<number>();
  let last_confirmed_at = 0;
  
  for (const claim of claims) {
    total_wei += BigInt(claim.amount_wei);
    cartridges.add(claim.cartridge_id);
    last_confirmed_at = Math.max(last_confirmed_at, claim.confirmed_at);
  }
  
  return {
    wallet,
    total_wei: total_wei.toString(),
    claims: claims.length,
    cartridges: cartridges.size,
    last_confirmed_at
  };
}

export async function countWalletsAbove(period: Period, totalWei: string): Promise<number> {
  const d = getDB();
  const since = sinceForPeriod(period);
  
  // Get all wallet totals using the same logic as getLeaderboardTop
  const claimsResult = await d.pool.query(`
    SELECT wallet, amount_wei
    FROM claims
    WHERE status='confirmed' AND ($1=0 OR confirmed_at >= $1)
  `, [since]);
  const claims = claimsResult.rows as Array<{
    wallet: string;
    amount_wei: string;
  }>;
  
  // Group by wallet and sum manually
  const walletTotals = new Map<string, bigint>();
  for (const claim of claims) {
    const existing = walletTotals.get(claim.wallet) || 0n;
    walletTotals.set(claim.wallet, existing + BigInt(claim.amount_wei));
  }
  
  // Count wallets with higher totals
  const meWei = BigInt(totalWei);
  let count = 0;
  for (const [_, wei] of walletTotals) {
    if (wei > meWei) count++;
  }
  
  return count;
}

// Teams helper functions
export async function getCurrentSeasonId(db: any): Promise<number> {
  const slug = process.env.SEASON_SLUG;
  
  if (!slug) {
    throw new Error('SEASON_SLUG environment variable not set');
  }
  
  const row = await db.pool.query('SELECT id FROM seasons WHERE slug=$1', [slug]);
  
  if (!row.rows[0]) {
    throw new Error(`Season with slug '${slug}' not found`);
  }
  return row.rows[0].id;
}

export type TeamRow = { id: number; slug: string; name: string; emoji?: string; color?: string; };

export async function listTeams(db: any): Promise<TeamRow[]> {
  const result = await db.pool.query(
    'SELECT id, slug, name, emoji, color FROM teams WHERE is_active=true ORDER BY id'
  );
  return result.rows;
}

export async function getUserTeam(db: any, wallet: string, seasonId: number): Promise<TeamRow | null> {
  const result = await db.pool.query(
    `SELECT t.id, t.slug, t.name, t.emoji, t.color
     FROM user_teams ut
     JOIN teams t ON t.id = ut.team_id
     WHERE LOWER(ut.wallet)=LOWER($1) AND ut.season_id=$2`,
    [wallet, seasonId]
  );
  return result.rows[0] || null;
}

export async function setUserTeam(db: any, wallet: string, seasonId: number, teamSlug: string): Promise<void> {
  const teamResult = await db.pool.query('SELECT id FROM teams WHERE slug=$1 AND is_active=true', [teamSlug]);
  if (!teamResult.rows[0]) {
    throw new Error(`Team with slug '${teamSlug}' not found or inactive`);
  }
  
  const teamId = teamResult.rows[0].id;
  const editable = process.env.TEAMS_EDITABLE === 'true';

  if (!editable) {
    const existing = await db.pool.query(
      'SELECT 1 FROM user_teams WHERE LOWER(wallet)=LOWER($1) AND season_id=$2',
      [wallet, seasonId]
    );
    if (existing.rows[0]) {
      return; // Team already set and editing disabled
    }
  }

  await db.pool.query(
    `INSERT INTO user_teams (wallet, season_id, team_id)
     VALUES (LOWER($1),$2,$3)
     ON CONFLICT (season_id, wallet) DO UPDATE
       SET team_id = CASE WHEN $4=true THEN EXCLUDED.team_id ELSE user_teams.team_id END`,
    [wallet, seasonId, teamId, editable]
  );
}

// Team standings for leaderboard
export type TeamStanding = {
  slug: string;
  name: string;
  emoji?: string;
  color?: string;
  members: number;
  total_score: number;
};

export async function getTeamStandings(db: any, period: Period): Promise<TeamStanding[]> {
  const seasonId = await getCurrentSeasonId(db);
  const since = sinceForPeriod(period);
  
  const result = await db.pool.query(
    `SELECT
       t.slug, t.name, t.emoji, t.color,
       COUNT(DISTINCT ut.wallet) AS members,
       COALESCE(SUM(lb.total_wei::numeric), 0)::text AS total_score
     FROM teams t
     LEFT JOIN user_teams ut ON ut.team_id=t.id AND ut.season_id=$1
     LEFT JOIN (
       SELECT 
         wallet,
         SUM(amount_wei::numeric) as total_wei
       FROM claims 
       WHERE status='confirmed' AND ($2=0 OR confirmed_at >= $2)
       GROUP BY wallet
     ) lb ON LOWER(lb.wallet) = LOWER(ut.wallet)
     WHERE t.is_active=true
     GROUP BY t.id, t.slug, t.name, t.emoji, t.color
     ORDER BY COALESCE(SUM(lb.total_wei::numeric), 0) DESC`,
    [seasonId, since]
  );
  
  return result.rows.map(row => ({
    slug: row.slug,
    name: row.name,
    emoji: row.emoji,
    color: row.color,
    members: parseInt(row.members),
    total_score: row.total_score
  }));
}
