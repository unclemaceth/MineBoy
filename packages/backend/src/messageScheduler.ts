/**
 * Message Scheduler (PostgreSQL version)
 * 
 * Fair queueing system for paid messages:
 * - Round-robin across message types (PAID, SHILL, MINEBOY)
 * - Per-wallet cooldown periods
 * - Age-based priority boosting
 * - Prevents wallet spam
 */

import { getDB } from './db.js';

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
export async function updatePriorities(): Promise<number> {
  const db = getDB();
  const messages = await db.prepare(`
    SELECT id, created_at, priority
    FROM paid_messages
    WHERE status = 'active'
  `).all() as Array<{ id: string; created_at: number; priority: number }>;
  
  let updated = 0;
  
  const updateStmt = db.prepare(`
    UPDATE paid_messages SET priority = @priority WHERE id = @id
  `);
  
  for (const msg of messages) {
    const newPriority = calculatePriority(msg.created_at, 0);
    if (newPriority !== msg.priority) {
      await updateStmt.run({ priority: newPriority, id: msg.id });
      updated++;
    }
  }
  
  return updated;
}

/**
 * Pick next message to play from a specific lane (message type)
 * Respects per-wallet cooldown
 */
async function pickNextFromLane(messageType: string): Promise<{
  id: string;
  wallet: string;
  message: string;
  banner_duration_sec: number;
} | null> {
  const db = getDB();
  const cooldownSec = PER_WALLET_COOLDOWN[messageType as keyof typeof PER_WALLET_COOLDOWN] || 0;
  const cooldownStart = Date.now() - (cooldownSec * 1000);
  
  // Get wallets that are in cooldown
  const recentWallets = await db.prepare(`
    SELECT DISTINCT wallet
    FROM paid_messages
    WHERE played_at > @cooldownStart AND message_type = @messageType
  `).all({ cooldownStart, messageType });
  
  const walletList = recentWallets.map((r: any) => r.wallet);
  
  // Build exclusion clause
  const exclusionClause = walletList.length > 0
    ? `AND wallet NOT IN (${walletList.map(() => '?').join(',')})`
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
  
  const params = [messageType, ...walletList];
  // For PostgreSQL adapter, we need to handle this differently
  // Let's use a simpler query without dynamic params
  const result = walletList.length > 0 
    ? await db.prepare(`
        SELECT id, wallet, message, banner_duration_sec
        FROM paid_messages
        WHERE status = 'active' 
          AND message_type = @messageType
          AND wallet NOT IN (${walletList.map((_, i) => `@wallet${i}`).join(',')})
        ORDER BY priority ASC, created_at ASC
        LIMIT 1
      `).get({
        messageType,
        ...Object.fromEntries(walletList.map((w, i) => [`wallet${i}`, w]))
      })
    : await db.prepare(`
        SELECT id, wallet, message, banner_duration_sec
        FROM paid_messages
        WHERE status = 'active' 
          AND message_type = @messageType
        ORDER BY priority ASC, created_at ASC
        LIMIT 1
      `).get({ messageType });
  
  return result as any || null;
}

/**
 * Play a message (mark as playing, schedule expiration)
 */
async function playMessage(msg: { id: string; banner_duration_sec: number }): Promise<void> {
  const db = getDB();
  const now = Date.now();
  const expiresAt = now + (msg.banner_duration_sec * 1000);
  
  await db.prepare(`
    UPDATE paid_messages
    SET status = 'playing', played_at = @played_at, expires_at = @expires_at
    WHERE id = @id
  `).run({ played_at: now, expires_at: expiresAt, id: msg.id });
  
  console.log(`[MessageScheduler] Playing message ${msg.id} for ${msg.banner_duration_sec}s`);
  
  // Schedule automatic expiration
  setTimeout(async () => {
    try {
      await db.prepare(`
        UPDATE paid_messages
        SET status = 'expired'
        WHERE id = @id AND status = 'playing'
      `).run({ id: msg.id });
      
      console.log(`[MessageScheduler] Message ${msg.id} expired`);
    } catch (error) {
      console.error(`[MessageScheduler] Error expiring message ${msg.id}:`, error);
    }
  }, msg.banner_duration_sec * 1000);
}

/**
 * Main scheduler tick - pick and play next message
 * Returns true if a message was played, false otherwise
 */
export async function schedulerTick(): Promise<boolean> {
  // Update priorities based on age
  await updatePriorities();
  
  // Try each lane in weighted sequence
  for (const lane of LANE_SEQUENCE) {
    const next = await pickNextFromLane(lane);
    
    if (next) {
      await playMessage(next);
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
export async function getCurrentlyPlaying(): Promise<Array<{
  id: string;
  wallet: string;
  message: string;
  message_type: string;
  color: string;
  played_at: number;
  expires_at: number;
}>> {
  const db = getDB();
  return await db.prepare(`
    SELECT id, wallet, message, message_type, color, played_at, expires_at
    FROM paid_messages
    WHERE status = 'playing' AND expires_at > @now
    ORDER BY played_at DESC
  `).all({ now: Date.now() }) as any[];
}

/**
 * Force expire old playing messages (cleanup)
 */
export async function cleanupExpiredPlaying(): Promise<number> {
  const db = getDB();
  const now = Date.now();
  
  const result = await db.prepare(`
    UPDATE paid_messages
    SET status = 'expired'
    WHERE status = 'playing' AND expires_at <= @now
  `).run({ now });
  
  return result.changes;
}

/**
 * Start the message scheduler (runs every 10 seconds)
 */
export function startMessageScheduler(): void {
  console.log('[MessageScheduler] Starting scheduler (PostgreSQL)...');
  console.log('[MessageScheduler] Tick interval: 10 seconds');
  console.log('[MessageScheduler] Lane weights: PAID(5) MINEBOY(2) SHILL(1)');
  
  // Run immediately (async)
  schedulerTick().catch(err => 
    console.error('[MessageScheduler] Error in initial tick:', err)
  );
  
  // Then run every 10 seconds
  setInterval(() => {
    (async () => {
      try {
        await cleanupExpiredPlaying();
        await schedulerTick();
      } catch (error) {
        console.error('[MessageScheduler] Error in tick:', error);
      }
    })();
  }, 10_000); // 10 seconds
  
  // Update priorities every minute
  setInterval(() => {
    (async () => {
      try {
        const updated = await updatePriorities();
        if (updated > 0) {
          console.log(`[MessageScheduler] Updated ${updated} message priorities`);
        }
      } catch (error) {
        console.error('[MessageScheduler] Error updating priorities:', error);
      }
    })();
  }, 60_000); // 1 minute
}