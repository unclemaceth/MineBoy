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
  }
}

// Create a PostgreSQL adapter that mimics SQLite interface
class PostgreSQLAdapter {
  constructor(private pool: Pool) {}
  
  prepare(query: string) {
    // Convert SQLite syntax to PostgreSQL
    let pgQuery = query
      .replace(/INSERT OR IGNORE/g, 'INSERT')
      .replace(/@(\w+)/g, (match, param) => `$${this.getParamIndex(param)}`)
      .replace(/ON CONFLICT \(id\) DO NOTHING/g, 'ON CONFLICT (id) DO NOTHING');
    
    return {
      run: async (params: any) => {
        const paramArray = Array.isArray(params) ? params : (params ? Object.values(params) : []);
        await this.pool.query(pgQuery, paramArray);
        return { changes: 1 }; // Mock SQLite return value
      },
      get: async (params: any) => {
        const paramArray = Array.isArray(params) ? params : (params ? Object.values(params) : []);
        const result = await this.pool.query(pgQuery, paramArray);
        return result.rows[0] || null;
      },
      all: async (params: any) => {
        const paramArray = Array.isArray(params) ? params : (params ? Object.values(params) : []);
        const result = await this.pool.query(pgQuery, paramArray);
        return result.rows;
      }
    };
  }
  
  exec(query: string) {
    // For CREATE TABLE statements, just run them
    this.pool.query(query);
  }
  
  private getParamIndex(param: string): number {
    // Simple mapping - in practice you'd want a more sophisticated approach
    const paramMap: { [key: string]: number } = {
      'id': 1, 'wallet': 2, 'cartridge_id': 3, 'hash': 4, 'amount_wei': 5,
      'tx_hash': 6, 'status': 7, 'created_at': 8, 'confirmed_at': 9, 'pending_expires_at': 10,
      'claimId': 1, 'txHash': 2, 'confirmedAt': 3
    };
    return paramMap[param] || 1;
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
  const stmt = d.prepare(`UPDATE claims SET tx_hash=@txHash WHERE id=@claimId AND status='pending'`);
  await stmt.run({ claimId, txHash }); // ← await
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
};

export async function getLeaderboardTop(period: Period, limit = 25): Promise<LeaderboardEntry[]> {
  const d = getDB();
  const since = sinceForPeriod(period);
  
  // Get all confirmed claims for the period
  const claimsStmt = d.prepare(`
    SELECT wallet, amount_wei, confirmed_at, cartridge_id
    FROM claims
    WHERE status='confirmed' AND (@since=0 OR confirmed_at >= @since)
  `);
  const claims = await claimsStmt.all({ since }) as Array<{
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
  
  return results.slice(0, limit);
}

export async function getAggregateForWallet(period: Period, wallet: string): Promise<LeaderboardEntry | null> {
  const d = getDB();
  const since = sinceForPeriod(period);
  const stmt = d.prepare(`
    SELECT amount_wei, confirmed_at, cartridge_id
    FROM claims
    WHERE status='confirmed' AND lower(wallet)=lower(@wallet) AND (@since=0 OR confirmed_at >= @since)
  `);
  const claims = await stmt.all({ since, wallet }) as Array<{
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
  const claimsStmt = d.prepare(`
    SELECT wallet, amount_wei
    FROM claims
    WHERE status='confirmed' AND (@since=0 OR confirmed_at >= @since)
  `);
  const claims = await claimsStmt.all({ since }) as Array<{
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
