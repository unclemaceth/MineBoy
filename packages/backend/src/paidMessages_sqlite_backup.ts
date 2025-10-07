// Production-ready paid messages module with on-chain verification via router contract
import { createPublicClient, http, isAddress, parseEther, formatEther, type Hash, defineChain, decodeEventLog, parseAbiItem, keccak256, toBytes } from 'viem';
import { randomUUID } from 'crypto';
import { getDB } from './db.js';

const HOUR_MS = 60 * 60 * 1000;
const ONE_APE_WEI = parseEther('1');
const ROUTER_ADDRESS = (process.env.PAID_MESSAGES_ROUTER || '').toLowerCase();
const RPC_URL = process.env.ALCHEMY_RPC_URL || 'https://apechain-mainnet.g.alchemy.com/v2/3YobnRFCSYEuIC5c1ySEs';

// Event signature for router's Paid event
const PAID_EVENT = parseAbiItem('event Paid(address indexed payer, uint256 amount, bytes32 msgHash)');

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

// Initialize paid messages table (migration handles creation)
export async function initPaidMessagesTable() {
  console.log('[PaidMessages] Using PostgreSQL for message persistence');
}

export interface PaidMessage {
  id: string;
  wallet: string;
  message: string;
  tx_hash: string;
  amount_wei: string;
  created_at: number;
  expires_at: number;
  status: 'active' | 'expired' | 'removed' | 'playing' | 'queued';
  message_type: 'PAID' | 'SHILL' | 'MINEBOY';
  nonce?: number;
  msg_hash?: string;
  color: string;
  banner_duration_sec: number;
  priority: number;
  scheduled_at?: number;
  played_at?: number;
}

// Message type configurations
export const MESSAGE_TYPES = {
  PAID: {
    price: parseEther('1'),
    maxLen: 64,
    duration: 3600, // 1 hour
    color: '#4ade80', // green
    prefix: 'PAID CONTENT: ',
  },
  SHILL: {
    price: parseEther('15'),
    maxLen: 128,
    duration: 14400, // 4 hours
    color: '#ef4444', // red
    prefix: 'Shilled Content: ',
  },
  MINEBOY: {
    price: parseEther('0'),
    maxLen: 256,
    duration: 7200, // 2 hours
    color: '#ffffff', // white
    prefix: 'MineBoy: ',
  },
} as const;

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
export function validateMessage(raw: string, messageType: 'PAID' | 'SHILL' | 'MINEBOY' = 'PAID'): { ok: true; cleaned: string } | { ok: false; reason: string } {
  // DEBUG: Check message in validateMessage
  console.log('[PM:VALIDATE] Raw input:', JSON.stringify(raw));
  
  if (!raw || !raw.trim()) {
    return { ok: false, reason: 'Message cannot be empty' };
  }
  
  const cleaned = raw.normalize('NFKC').trim();
  console.log('[PM:VALIDATE] After NFKC normalize:', JSON.stringify(cleaned));
  console.log('[PM:VALIDATE] Contains "d" after normalize?', cleaned.includes('d') || cleaned.includes('D'));
  
  const maxLen = MESSAGE_TYPES[messageType].maxLen;
  
  if (cleaned.length > maxLen) {
    return { ok: false, reason: `Message must be ${maxLen} characters or less` };
  }
  
  if (!passesBlacklist(cleaned)) {
    return { ok: false, reason: 'Message contains inappropriate content' };
  }
  
  console.log('[PM:VALIDATE] Final cleaned (returning):', JSON.stringify(cleaned));
  console.log('[PM:VALIDATE] Contains "d" in final?', cleaned.includes('d') || cleaned.includes('D'));
  
  return { ok: true, cleaned };
}

/**
 * Verify transaction on-chain via router contract event
 */
export async function verifyOnChain(
  txHash: Hash, 
  claimedFrom: string, 
  messageText: string,
  messageType: 'PAID' | 'SHILL' | 'MINEBOY' = 'PAID'
) {
  if (!ROUTER_ADDRESS) {
    throw new Error('PAID_MESSAGES_ROUTER not configured');
  }

  // 1) fetch receipt
  const receipt = await client.getTransactionReceipt({ hash: txHash });

  // 2) basic checks
  if (!receipt || receipt.status !== 'success') {
    throw new Error('Transaction not confirmed');
  }
  if (!isAddress(claimedFrom)) {
    throw new Error('Invalid wallet address');
  }

  // 3) find the Paid event from our router
  const log = receipt.logs.find(l => l.address.toLowerCase() === ROUTER_ADDRESS);
  if (!log) {
    throw new Error('Router event not found - did you call the PaidMessagesRouter contract?');
  }

  // 4) decode the event
  let decoded;
  try {
    decoded = decodeEventLog({
      abi: [PAID_EVENT],
      data: log.data,
      topics: log.topics,
    });
  } catch (e) {
    throw new Error('Failed to decode Paid event');
  }

  const { payer, amount, msgHash } = decoded.args as { payer: string; amount: bigint; msgHash: string };

  // 5) verify payer matches claimed sender
  if (payer.toLowerCase() !== claimedFrom.toLowerCase()) {
    throw new Error('Transaction sender mismatch');
  }

  // 6) verify amount matches message type
  const expectedAmount = MESSAGE_TYPES[messageType].price;
  if (amount !== expectedAmount) {
    throw new Error(`Payment must be exactly ${formatEther(expectedAmount)} APE for ${messageType} messages`);
  }

  // 7) verify msgHash matches the message
  const expectedHash = keccak256(toBytes(messageText));
  if (msgHash.toLowerCase() !== expectedHash.toLowerCase()) {
    throw new Error('Message hash mismatch');
  }

  return {
    from: payer.toLowerCase(),
    amountWei: amount.toString(),
    blockNumber: receipt.blockNumber,
    msgHash,
    messageType,
  };
}

// Prepared statements
const insertStmt = db.prepare(`
  INSERT INTO paid_messages (
    id, wallet, message, tx_hash, amount_wei, created_at, expires_at, status,
    message_type, nonce, msg_hash, color, banner_duration_sec, priority
  )
  VALUES (
    @id, @wallet, @message, @tx_hash, @amount_wei, @created_at, @expires_at, @status,
    @message_type, @nonce, @msg_hash, @color, @banner_duration_sec, @priority
  )
`);

/**
 * Get next nonce for a wallet
 */
export function getNextNonce(wallet: string): number {
  const result = db.prepare(`
    SELECT MAX(nonce) as max_nonce 
    FROM paid_messages 
    WHERE wallet = ?
  `).get(wallet.toLowerCase()) as { max_nonce: number | null };
  
  return (result.max_nonce || 0) + 1;
}

/**
 * Compute message hash for deduplication
 */
export function computeMsgHash(wallet: string, content: string, nonce: number): string {
  return keccak256(toBytes(`${wallet.toLowerCase()}:${content}:${nonce}`));
}

/**
 * Check if wallet is blacklisted
 */
export function isBlacklisted(wallet: string): boolean {
  const result = db.prepare(`
    SELECT 1 FROM blacklisted_wallets WHERE wallet = ?
  `).get(wallet.toLowerCase());
  
  return !!result;
}

/**
 * Check max pending messages per wallet
 * Limit: 50 total active messages per hour (system-wide)
 * Limit: 3 pending per wallet
 */
export function checkPendingLimit(wallet: string): void {
  // Check system-wide active message limit (50 messages max)
  const systemResult = db.prepare(`
    SELECT COUNT(*) as count 
    FROM paid_messages 
    WHERE status IN ('active', 'playing', 'queued')
  `).get() as { count: number };
  
  if (systemResult.count >= 50) {
    throw new Error('Message queue is full (50 active messages). Please try again in a few minutes.');
  }
  
  // Check per-wallet limit (3 pending)
  const result = db.prepare(`
    SELECT COUNT(*) as count 
    FROM paid_messages 
    WHERE wallet = ? AND status IN ('active', 'playing', 'queued')
  `).get(wallet.toLowerCase()) as { count: number };
  
  if (result.count >= 3) {
    throw new Error('You already have 3 pending messages. Wait for one to play.');
  }
}

/**
 * Check daily message limit per wallet (limit: 10)
 */
export function checkDailyLimit(wallet: string): void {
  const dayStart = Date.now() - (24 * 3600 * 1000);
  
  const result = db.prepare(`
    SELECT COUNT(*) as count 
    FROM paid_messages 
    WHERE wallet = ? AND created_at > ?
  `).get(wallet.toLowerCase(), dayStart) as { count: number };
  
  if (result.count >= 10) {
    throw new Error('Daily limit reached (10 messages per 24 hours)');
  }
}

/**
 * Add a paid message to the database
 */
export function addPaidMessage(params: { 
  wallet: string; 
  message: string; 
  txHash: string; 
  amountWei: string;
  messageType: 'PAID' | 'SHILL' | 'MINEBOY';
}) {
  const now = Date.now();
  const id = randomUUID();
  const wallet = params.wallet.toLowerCase();
  
  // Check blacklist
  if (isBlacklisted(wallet)) {
    throw new Error('This wallet is blacklisted');
  }
  
  // Check pending limit
  checkPendingLimit(wallet);
  
  // Check daily limit
  checkDailyLimit(wallet);
  
  // Get next nonce
  const nonce = getNextNonce(wallet);
  
  // Compute msg hash
  const msg_hash = computeMsgHash(wallet, params.message, nonce);
  
  // Get config for message type
  const config = MESSAGE_TYPES[params.messageType];
  const duration_ms = config.duration * 1000;
  
  // DEBUG: Check message before DB insert
  console.log('[PM:DB] Message before insert:', JSON.stringify(params.message));
  console.log('[PM:DB] Contains "d" before insert?', params.message?.includes('d') || params.message?.includes('D'));
  
  const row = {
    id,
    wallet,
    message: params.message,
    tx_hash: params.txHash.toLowerCase(),
    amount_wei: params.amountWei,
    created_at: now,
    expires_at: now + duration_ms,
    status: 'active',
    message_type: params.messageType,
    nonce,
    msg_hash,
    color: config.color,
    banner_duration_sec: config.duration,
    priority: 0, // Default priority, can be adjusted later
  };
  
  try {
    insertStmt.run(row);
    return { id, createdAt: now, expiresAt: row.expires_at, nonce, msgHash: msg_hash };
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      if (error.message.includes('tx_hash')) {
        throw new Error('This transaction hash was already used');
      }
      if (error.message.includes('msg_hash')) {
        throw new Error('You already submitted this exact message');
      }
      if (error.message.includes('nonce')) {
        throw new Error('Nonce conflict - please try again');
      }
    }
    throw error;
  }
}

/**
 * Get all active paid messages with full metadata
 */
export function getActivePaidMessages(): Array<{ 
  id: string; 
  wallet: string; 
  message: string; 
  createdAt: number; 
  expiresAt: number;
  messageType: string;
  color: string;
  bannerDurationSec: number;
  prefix: string;
}> {
  const stmt = db.prepare(`
    SELECT 
      id, wallet, message, 
      created_at as createdAt, 
      expires_at as expiresAt,
      message_type as messageType,
      color,
      banner_duration_sec as bannerDurationSec
    FROM paid_messages
    WHERE status = 'active' AND expires_at > ?
    ORDER BY priority ASC, created_at ASC
  `);
  const rows = stmt.all(Date.now()) as any[];
  
  // Add prefix based on message type
  return rows.map(row => ({
    ...row,
    prefix: MESSAGE_TYPES[row.messageType as 'PAID' | 'SHILL' | 'MINEBOY']?.prefix || '',
  }));
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