// Production-ready paid messages module with on-chain verification
import { createPublicClient, http, isAddress, parseEther, type Hash, defineChain } from 'viem';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

const HOUR_MS = 60 * 60 * 1000;
const ONE_APE_WEI = parseEther('1');
const TEAM_WALLET = '0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5'.toLowerCase();
const RPC_URL = process.env.ALCHEMY_RPC_URL || 'https://apechain-mainnet.g.alchemy.com/v2/3YobnRFCSYEuIC5c1ySEs';

// Define ApeChain
const apechain = defineChain({
  id: 33139,
  name: 'ApeChain',
  nativeCurrency: { name: 'ApeCoin', symbol: 'APE', decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] }
  },
  blockExplorers: {
    default: { name: 'ApeScan', url: 'https://apescan.io' }
  }
});

// Public client for ApeChain
const client = createPublicClient({
  chain: apechain,
  transport: http(RPC_URL)
});

// Database setup
const db = new Database(process.env.DB_PATH || './paid_messages.db');
db.pragma('journal_mode = WAL');

// Initialize table
export function initPaidMessagesTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS paid_messages (
      id TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      message TEXT NOT NULL,
      tx_hash TEXT NOT NULL UNIQUE,
      amount_wei TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
    );
    CREATE INDEX IF NOT EXISTS idx_paid_messages_status_expires ON paid_messages(status, expires_at);
    CREATE INDEX IF NOT EXISTS idx_paid_messages_created ON paid_messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_paid_messages_wallet ON paid_messages(wallet);
  `);
  console.log('[PaidMessages] Database initialized');
}

export interface PaidMessage {
  id: string;
  wallet: string;
  message: string;
  tx_hash: string;
  amount_wei: string;
  created_at: number;
  expires_at: number;
  status: 'active' | 'expired' | 'removed';
}

// Comprehensive blacklist
const BLACKLIST = [
  // Profanity
  'fuck', 'fucker', 'fucking', 'motherfucker', 'shit', 'bullshit', 'piss',
  'ass', 'arse', 'asshole', 'arsehole', 'dumbass', 'bastard', 'damn', 'goddamn',
  'dick', 'dickhead', 'bellend', 'knob', 'twat', 'wanker', 'prick', 'tosser',
  'bollocks', 'cunt', 'bitch',
  
  // Sexual/Explicit
  'cum', 'jizz', 'bukkake', 'blowjob', 'handjob', 'rimjob', 'deepthroat',
  'porn', 'porno', 'xxx', 'nsfw', 'rape', 'pussy', 'cock', 'penis', 'vagina',
  
  // Harassment
  'retard', 'retarded', 'kill yourself', 'kys', 'go die', 'die in a fire',
  
  // Hate Slurs
  'nigger', 'nigga', 'chink', 'gook', 'paki', 'spic', 'wetback', 'beaner',
  'coon', 'kike', 'raghead', 'fag', 'faggot', 'dyke', 'tranny',
  
  // Spam/Scam
  'free crypto', 'free ape', 'claim airdrop', 'airdrop now',
  'seed phrase', 'private key', 'click my link', 'dm me for prize',
];

// Regex patterns for leetspeak/obfuscation
const REGEX_PATTERNS: RegExp[] = [
  /f+[\W_]*[uμv][\W_]*[cçkq]+[\W_]*k+/i,  // fuck variants
  /s+[\W_]*h+[\W_]*[i1!|]+[\W_]*t+/i,      // shit variants
  /a+[\W_]*s+[\W_]*s+[\W_]*h+[\W_]*o+[\W_]*l+[\W_]*e+/i, // asshole variants
  /c+[\W_]*u+[\W_]*n+[\W_]*t+/i,           // cunt variants
  /f+a+g+g*o*t+/i,                         // faggot variants
  /n+[i1!|]+g+[e3]+r+/i,                   // n-word variants
  /(kys|kill[\W_]*yourself|go[\W_]*die)/i, // suicide encouragement
  /(claim|free|bonus).*(airdrop|reward)/i, // crypto spam
];

/**
 * Normalize text for consistent matching (NFKC normalization + lowercase)
 */
function normalizeText(text: string): string {
  return text.normalize('NFKC').toLowerCase();
}

/**
 * Check if message passes blacklist and regex filters
 */
function passesBlacklist(msg: string): boolean {
  const normalized = normalizeText(msg);
  
  // Check exact word/phrase matches
  for (const term of BLACKLIST) {
    if (normalized.includes(term.toLowerCase())) {
      return false;
    }
  }
  
  // Check regex patterns
  return !REGEX_PATTERNS.some(pattern => pattern.test(normalized));
}

/**
 * Validate message content
 */
export function validateMessage(raw: string): { ok: true; cleaned: string } | { ok: false; reason: string } {
  if (!raw || !raw.trim()) {
    return { ok: false, reason: 'Message cannot be empty' };
  }
  
  const cleaned = raw.normalize('NFKC').trim();
  
  if (cleaned.length > 64) {
    return { ok: false, reason: 'Message must be 64 characters or less' };
  }
  
  if (!passesBlacklist(cleaned)) {
    return { ok: false, reason: 'Message contains inappropriate content' };
  }
  
  return { ok: true, cleaned };
}

/**
 * Verify transaction on-chain
 */
export async function verifyOnChain(txHash: Hash, claimedFrom: string) {
  // Fetch transaction and receipt
  const [tx, receipt] = await Promise.all([
    client.getTransaction({ hash: txHash }),
    client.getTransactionReceipt({ hash: txHash }),
  ]);

  // Basic checks
  if (!receipt || receipt.status !== 'success') {
    throw new Error('Transaction not confirmed');
  }
  
  if (!isAddress(claimedFrom)) {
    throw new Error('Invalid wallet address');
  }

  const from = tx.from.toLowerCase();
  const to = (tx.to || '').toLowerCase();

  if (from !== claimedFrom.toLowerCase()) {
    throw new Error('Transaction sender mismatch');
  }
  
  if (to !== TEAM_WALLET) {
    throw new Error('Payment did not go to team wallet');
  }

  // Exact amount check: must be 1 APE
  if (tx.value !== ONE_APE_WEI) {
    throw new Error('Payment must be exactly 1 APE');
  }

  return {
    from,
    to,
    amountWei: tx.value.toString(),
    blockNumber: receipt.blockNumber,
  };
}

// Prepared statements
const insertStmt = db.prepare(`
  INSERT INTO paid_messages (id, wallet, message, tx_hash, amount_wei, created_at, expires_at, status)
  VALUES (@id, @wallet, @message, @tx_hash, @amount_wei, @created_at, @expires_at, @status)
`);

/**
 * Add a paid message to the database
 */
export function addPaidMessage(params: { wallet: string; message: string; txHash: string; amountWei: string }) {
  const now = Date.now();
  const id = randomUUID();
  
  const row = {
    id,
    wallet: params.wallet.toLowerCase(),
    message: params.message,
    tx_hash: params.txHash.toLowerCase(),
    amount_wei: params.amountWei,
    created_at: now,
    expires_at: now + HOUR_MS,
    status: 'active',
  };
  
  try {
    insertStmt.run(row);
    return { id, createdAt: now, expiresAt: row.expires_at };
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      throw new Error('This transaction hash was already used');
    }
    throw error;
  }
}

/**
 * Get all active paid messages
 */
export function getActivePaidMessages(): Array<{ id: string; wallet: string; message: string; createdAt: number; expiresAt: number }> {
  const stmt = db.prepare(`
    SELECT id, wallet, message, created_at as createdAt, expires_at as expiresAt
    FROM paid_messages
    WHERE status = 'active' AND expires_at > ?
    ORDER BY created_at DESC
  `);
  return stmt.all(Date.now()) as any;
}

/**
 * Mark expired messages
 */
export function markExpired(): number {
  const now = Date.now();
  const stmt = db.prepare(`
    UPDATE paid_messages
    SET status = 'expired'
    WHERE status = 'active' AND expires_at <= ?
  `);
  const info = stmt.run(now);
  return info.changes;
}

/**
 * Remove a paid message (admin)
 */
export function removePaidMessage(id: string): boolean {
  const stmt = db.prepare(`UPDATE paid_messages SET status='removed' WHERE id = ?`);
  const info = stmt.run(id);
  return info.changes > 0;
}

/**
 * Get statistics
 */
export function getStats() {
  const rowTotals = db.prepare(`SELECT COUNT(*) as total FROM paid_messages`).get() as { total: number };
  const rowActive = db.prepare(`SELECT COUNT(*) as active FROM paid_messages WHERE status='active' AND expires_at > ?`).get(Date.now()) as { active: number };
  const rowExpired = db.prepare(`SELECT COUNT(*) as expired FROM paid_messages WHERE status='expired'`).get() as { expired: number };
  const rowRemoved = db.prepare(`SELECT COUNT(*) as removed FROM paid_messages WHERE status='removed'`).get() as { removed: number };
  const revenue = db.prepare(`SELECT COALESCE(SUM(CAST(amount_wei AS INTEGER)), 0) as totalWei FROM paid_messages`).get() as { totalWei: number | string };
  
  return {
    total: rowTotals.total,
    active: rowActive.active,
    expired: rowExpired.expired,
    removed: rowRemoved.removed,
    totalRevenue: String(revenue.totalWei ?? '0'),
  };
}

// Per-wallet rate limiting (in-memory)
const perWalletWindowMs = 60_000;
const perWalletMax = 6;
const walletBucket = new Map<string, { count: number; resetAt: number }>();

export function walletRateLimit(addr: string) {
  const now = Date.now();
  const key = addr.toLowerCase();
  const rec = walletBucket.get(key) || { count: 0, resetAt: now + perWalletWindowMs };
  
  if (now > rec.resetAt) {
    rec.count = 0;
    rec.resetAt = now + perWalletWindowMs;
  }
  
  rec.count += 1;
  walletBucket.set(key, rec);
  
  if (rec.count > perWalletMax) {
    throw new Error('Slow down: too many submissions, try again in a minute.');
  }
}

// Cleanup expired messages every 5 minutes
setInterval(() => {
  const changed = markExpired();
  if (changed > 0) {
    console.log(`[PaidMessages] Expired ${changed} messages`);
  }
}, 5 * 60 * 1000);