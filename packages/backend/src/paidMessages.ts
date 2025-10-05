// packages/backend/src/paidMessages.ts
import { getDB } from './db.js';

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

// Comprehensive blacklist of inappropriate words and phrases (case-insensitive)
const BLACKLIST = [
  // Profanity - General
  'fuck', 'fucker', 'fucking', 'motherfucker', 'motherfuckers', 'mf',
  'shit', 'bullshit', 'dipshit', 'horseshit',
  'piss', 'pissed', 'pissing',
  'ass', 'arse', 'asshole', 'arsehole', 'dumbass',
  'bastard', 'bloody hell', 'damn', 'goddamn', 'god damn',
  'dick', 'dicks', 'dickhead', 'bellend', 'knob', 'knobhead', 'knobend',
  'twat', 'twats', 'wanker', 'wankers', 'bugger', 'prick', 'tosser',
  'bollocks', 'bollock', 'bollocking', 'cunt', 'cunts', 'bitch', 'bitches',
  
  // Sexual/Explicit
  'cum', 'jizz', 'jism', 'splooge', 'bukkake', 'bukake',
  'blowjob', 'handjob', 'rimjob', 'rim job', 'deepthroat', 'deep throat',
  'fingering', 'fisted', 'fisting', 'porn', 'porno', 'pornography',
  'xxx', 'nsfw', 'anal', 'gangbang', 'gang bang', 'rape', 'pussy', 'cock',
  'penis', 'vagina', 'suck my', 'eat my', 'sit on my face',
  
  // Harassment/Insults
  'retard', 'retarded', 'kill yourself', 'kys', 'go die', 'die in a fire',
  'diaf', 'i hope you die', 'neck yourself', 'rope yourself',
  
  // Threats/Violence
  'i will kill you', 'im going to kill you', "i'm going to kill you",
  'i will hurt you', 'i will beat you', 'beat you to death',
  'rape you', 'im going to rape you', "i'm going to rape you",
  'lynch you', 'gas you', 'hunt you down', 'murder you',
  
  // Hate Slurs - Race/Ethnicity
  'nigger', 'nigga', 'chink', 'gook', 'paki', 'spic', 'wetback', 'beaner',
  'coon', 'sambo', 'porch monkey', 'jigaboo', 'jiggaboo', 'gyppo', 'gypsy',
  'kraut', 'mick', 'wop', 'nip',
  
  // Hate Slurs - Religion
  'kike', 'christkiller', 'raghead', 'infidel', 'islamotard', 'islamofascist',
  
  // Hate Slurs - Sexual Orientation/Gender
  'fag', 'faggot', 'dyke', 'tranny', 'shemale', 'butt pirate',
  'fairy', 'poof', 'poofta', 'pouf',
  
  // Hate Slurs - Disability
  'spastic', 'spaz', 'mong', 'mongoloid', 'cripple', 'crip', 'lamebrain',
  
  // Hate Phrases
  'go back to your country', 'you dont belong here', 'no blacks allowed',
  'no gays allowed', 'gas the jews', 'all lives dont matter',
  
  // Drugs (illegal)
  'meth', 'methamphetamine', 'crack cocaine', 'heroin', 'fentanyl',
  
  // Spam/Scam
  'free crypto', 'free ape', 'claim airdrop', 'airdrop now',
  'send seed phrase', 'seed phrase', 'private key', 'click my link',
  'dm me for prize', 'giveaway winner', 'whatsapp me', 'telegram me',
  'venmo me', 'cashapp me', 'onlyfans',
  
  // Historical figures/groups (hate context)
  'nazi', 'hitler', 'kkk', 'white power', 'white supremacy',
  
  // ASCII art patterns
  '8===', '==D', '=D', '( . )( . )', '(.)(.)','8==D', '8=D',
];

// Regex patterns for leetspeak and obfuscation
const REGEX_PATTERNS = [
  /\bf+[\W_]*[uμv][\W_]*[cçkq]+[\W_]*k+\b/i,  // fuck variants
  /\bs+[\W_]*h+[\W_]*[i1!|]+[\W_]*t+\b/i,      // shit variants
  /\ba+[\W_]*s+[\W_]*s+[\W_]*h+[\W_]*o+[\W_]*l+[\W_]*e+\b/i, // asshole variants
  /\bc+[\W_]*u+[\W_]*n+[\W_]*t+\b/i,           // cunt variants
  /\bf+a+g+g*o*t+\b/i,                         // faggot variants
  /\bd+y+k+e+\b/i,                             // dyke variants
  /\bk[i1!|]ke\b/i,                            // kike variants
  /\bsp[a@]z|sp[a@]st[i1!|]c\b/i,             // spaz/spastic variants
  /\b(kys|kill[\W_]*yourself|go[\W_]*die)\b/i, // suicide encouragement
  /\bn+[i1!|]+g+[e3]+r+\b/i,                   // n-word variants
  /\bn+[i1!|]+g+a+\b/i,                        // n-word variants
];

/**
 * Normalize text for consistent matching (NFKC normalization + lowercase)
 */
function normalizeText(text: string): string {
  return text.normalize('NFKC').toLowerCase();
}

/**
 * Check if message contains blacklisted words or matches regex patterns
 */
export function containsBlacklistedWord(message: string): boolean {
  const normalized = normalizeText(message);
  
  // Check exact word/phrase matches
  const hasBlacklistedWord = BLACKLIST.some(word => normalized.includes(word.toLowerCase()));
  if (hasBlacklistedWord) {
    return true;
  }
  
  // Check regex patterns for leetspeak/obfuscation
  const matchesPattern = REGEX_PATTERNS.some(pattern => pattern.test(normalized));
  if (matchesPattern) {
    return true;
  }
  
  return false;
}

/**
 * Validate message content
 */
export function validateMessage(message: string): { valid: boolean; error?: string } {
  if (!message || message.trim().length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }
  
  if (message.length > 64) {
    return { valid: false, error: 'Message must be 64 characters or less' };
  }
  
  if (containsBlacklistedWord(message)) {
    return { valid: false, error: 'Message contains inappropriate content' };
  }
  
  return { valid: true };
}

/**
 * Initialize paid messages table
 */
export function initPaidMessagesTable() {
  const db = getDB();
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS paid_messages (
      id TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      message TEXT NOT NULL,
      tx_hash TEXT NOT NULL UNIQUE,
      amount_wei TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      UNIQUE(tx_hash)
    );
    
    CREATE INDEX IF NOT EXISTS idx_paid_messages_status ON paid_messages(status);
    CREATE INDEX IF NOT EXISTS idx_paid_messages_expires_at ON paid_messages(expires_at);
  `);
}

/**
 * Add a paid message
 */
export function addPaidMessage(
  id: string,
  wallet: string,
  message: string,
  txHash: string,
  amountWei: string
): void {
  const db = getDB();
  const now = Date.now();
  const expiresAt = now + (60 * 60 * 1000); // 1 hour from now
  
  const stmt = db.prepare(`
    INSERT INTO paid_messages (id, wallet, message, tx_hash, amount_wei, created_at, expires_at, status)
    VALUES (@id, @wallet, @message, @txHash, @amountWei, @createdAt, @expiresAt, 'active')
  `);
  
  stmt.run({
    id,
    wallet: wallet.toLowerCase(),
    message,
    txHash: txHash.toLowerCase(),
    amountWei,
    createdAt: now,
    expiresAt,
  });
}

/**
 * Get all active paid messages
 */
export function getActivePaidMessages(): PaidMessage[] {
  const db = getDB();
  const now = Date.now();
  
  const stmt = db.prepare(`
    SELECT * FROM paid_messages
    WHERE status = 'active' AND expires_at > @now
    ORDER BY created_at DESC
  `);
  
  return stmt.all({ now }) as PaidMessage[];
}

/**
 * Check if transaction hash already used
 */
export function isPaidMessageTxUsed(txHash: string): boolean {
  const db = getDB();
  
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM paid_messages WHERE tx_hash = @txHash
  `);
  
  const result = stmt.get({ txHash: txHash.toLowerCase() }) as { count: number };
  return result.count > 0;
}

/**
 * Remove a paid message (admin action)
 */
export function removePaidMessage(id: string): boolean {
  const db = getDB();
  
  const stmt = db.prepare(`
    UPDATE paid_messages SET status = 'removed' WHERE id = @id
  `);
  
  const result = stmt.run({ id });
  return result.changes > 0;
}

/**
 * Expire old messages (cleanup task)
 */
export function expireOldMessages(): number {
  const db = getDB();
  const now = Date.now();
  
  const stmt = db.prepare(`
    UPDATE paid_messages 
    SET status = 'expired' 
    WHERE status = 'active' AND expires_at <= @now
  `);
  
  const result = stmt.run({ now });
  return result.changes;
}

/**
 * Get message statistics
 */
export function getPaidMessageStats(): {
  total: number;
  active: number;
  expired: number;
  removed: number;
  totalRevenue: string;
} {
  const db = getDB();
  
  const stmt = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
      SUM(CASE WHEN status = 'removed' THEN 1 ELSE 0 END) as removed,
      SUM(CAST(amount_wei AS INTEGER)) as total_revenue
    FROM paid_messages
  `);
  
  const result = stmt.get() as any;
  
  return {
    total: result.total || 0,
    active: result.active || 0,
    expired: result.expired || 0,
    removed: result.removed || 0,
    totalRevenue: (result.total_revenue || 0).toString(),
  };
}
