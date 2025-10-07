/**
 * Message Scheduler
 * 
 * Fair queueing system for paid messages:
 * - Round-robin across message types (PAID, SHILL, MINEBOY)
 * - Per-wallet cooldown periods
 * - Age-based priority boosting
 * - Prevents wallet spam
 */

import Database from 'better-sqlite3';

const db = new Database(process.env.DB_PATH || './paid_messages.db');

// Interleaved round-robin lanes for better distribution
// Pattern: SHILL > PAID > MINEBOY (priority order)
// But distributed to avoid grouping same types together
const LANE_SEQUENCE = [
  'SHILL',    // 1: Highest priority (15 APE)
  'PAID',     // 2
  'MINEBOY',  // 3
  'PAID',     // 4
  'MINEBOY',  // 5
  'PAID',     // 6
  'PAID',     // 7
  'PAID',     // 8
  // Gives: SHILL(1/8), PAID(5/8), MINEBOY(2/8)
  // But interleaved throughout instead of grouped
];

// Per-wallet cooldown (seconds between plays for the same wallet)
const PER_WALLET_COOLDOWN = {
  PAID: 600,    // 10 minutes
  SHILL: 14400, // 4 hours (only 1 active at a time)
  MINEBOY: 0,   // No cooldown for system messages
};

// Age boost: +1 priority per 10 minutes waiting
const AGE_BOOST_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Calculate priority with age boost
 * Lower priority = plays sooner
 */
function calculatePriority(createdAt: number, basePriority: number): number {
  const ageMs = Date.now() - createdAt;
  const ageBoost = Math.floor(ageMs / AGE_BOOST_INTERVAL_MS);
  return basePriority - ageBoost; // Lower number = higher priority
}

/**
 * Update priorities for all active messages based on age
 */
export function updatePriorities(): number {
  const messages = db.prepare(`
    SELECT id, created_at, priority
    FROM paid_messages
    WHERE status = 'active'
  `).all() as Array<{ id: string; created_at: number; priority: number }>;
  
  let updated = 0;
  
  const updateStmt = db.prepare(`
    UPDATE paid_messages SET priority = ? WHERE id = ?
  `);
  
  for (const msg of messages) {
    const newPriority = calculatePriority(msg.created_at, 0);
    if (newPriority !== msg.priority) {
      updateStmt.run(newPriority, msg.id);
      updated++;
    }
  }
  
  return updated;
}

/**
 * Pick next message to play from a specific lane (message type)
 * Respects per-wallet cooldown
 */
function pickNextFromLane(messageType: string): {
  id: string;
  wallet: string;
  message: string;
  banner_duration_sec: number;
} | null {
  const cooldownSec = PER_WALLET_COOLDOWN[messageType as keyof typeof PER_WALLET_COOLDOWN] || 0;
  const cooldownStart = Date.now() - (cooldownSec * 1000);
  
  // Get wallets that are in cooldown
  const recentWallets = db.prepare(`
    SELECT DISTINCT wallet
    FROM paid_messages
    WHERE played_at > ? AND message_type = ?
  `).all(cooldownStart, messageType).map((r: any) => r.wallet);
  
  // Build exclusion clause
  const exclusionClause = recentWallets.length > 0
    ? `AND wallet NOT IN (${recentWallets.map(() => '?').join(',')})`
    : '';
  
  // Find next eligible message
  const query = `
    SELECT id, wallet, message, banner_duration_sec
    FROM paid_messages
    WHERE status = 'active' 
      AND message_type = ?
      ${exclusionClause}
    ORDER BY priority ASC, created_at ASC
    LIMIT 1
  `;
  
  const params = [messageType, ...recentWallets];
  const result = db.prepare(query).get(...params) as any;
  
  return result || null;
}

/**
 * Play a message (mark as playing, schedule expiration)
 */
function playMessage(msg: { id: string; banner_duration_sec: number }): void {
  const now = Date.now();
  const expiresAt = now + (msg.banner_duration_sec * 1000);
  
  db.prepare(`
    UPDATE paid_messages
    SET status = 'playing', played_at = ?, expires_at = ?
    WHERE id = ?
  `).run(now, expiresAt, msg.id);
  
  console.log(`[MessageScheduler] Playing message ${msg.id} for ${msg.banner_duration_sec}s`);
  
  // Schedule automatic expiration
  setTimeout(() => {
    db.prepare(`
      UPDATE paid_messages
      SET status = 'expired'
      WHERE id = ? AND status = 'playing'
    `).run(msg.id);
    
    console.log(`[MessageScheduler] Message ${msg.id} expired`);
  }, msg.banner_duration_sec * 1000);
}

/**
 * Main scheduler tick - pick and play next message
 * Returns true if a message was played, false otherwise
 */
export function schedulerTick(): boolean {
  // Update priorities based on age
  updatePriorities();
  
  // Try each lane in weighted sequence
  for (const lane of LANE_SEQUENCE) {
    const next = pickNextFromLane(lane);
    
    if (next) {
      playMessage(next);
      console.log(`[MessageScheduler] Played from ${lane} lane: "${next.message.substring(0, 40)}..."`);
      return true;
    }
  }
  
  // No messages available in any lane
  return false;
}

/**
 * Get currently playing messages
 */
export function getCurrentlyPlaying(): Array<{
  id: string;
  wallet: string;
  message: string;
  message_type: string;
  color: string;
  played_at: number;
  expires_at: number;
}> {
  return db.prepare(`
    SELECT id, wallet, message, message_type, color, played_at, expires_at
    FROM paid_messages
    WHERE status = 'playing' AND expires_at > ?
    ORDER BY played_at DESC
  `).all(Date.now()) as any[];
}

/**
 * Force expire old playing messages (cleanup)
 */
export function cleanupExpiredPlaying(): number {
  const now = Date.now();
  
  const result = db.prepare(`
    UPDATE paid_messages
    SET status = 'expired'
    WHERE status = 'playing' AND expires_at <= ?
  `).run(now);
  
  return result.changes;
}

/**
 * Start the message scheduler (runs every 10 seconds)
 */
export function startMessageScheduler(): void {
  console.log('[MessageScheduler] Starting scheduler...');
  console.log('[MessageScheduler] Tick interval: 10 seconds');
  console.log('[MessageScheduler] Lane weights: PAID(5) MINEBOY(2) SHILL(1)');
  
  // Run immediately
  schedulerTick();
  
  // Then run every 10 seconds
  setInterval(() => {
    try {
      cleanupExpiredPlaying();
      schedulerTick();
    } catch (error) {
      console.error('[MessageScheduler] Error in tick:', error);
    }
  }, 10_000); // 10 seconds
  
  // Update priorities every minute
  setInterval(() => {
    try {
      const updated = updatePriorities();
      if (updated > 0) {
        console.log(`[MessageScheduler] Updated ${updated} message priorities`);
      }
    } catch (error) {
      console.error('[MessageScheduler] Error updating priorities:', error);
    }
  }, 60_000); // 1 minute
}
