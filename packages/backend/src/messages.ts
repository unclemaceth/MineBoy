/**
 * MINEBOY Admin Messages (PostgreSQL version)
 * 
 * Stores admin-created messages in database for persistence across deploys
 */

import { randomUUID } from 'crypto';
import { getDB } from './db.js';
import { MESSAGE_TYPES } from './paidMessages.js';

/**
 * Add a MINEBOY admin message
 * These are free messages from the admin that persist in the database
 */
export async function addMineboyMessage(text: string): Promise<string> {
  const db = getDB();
  const id = randomUUID();
  const now = Date.now();
  const config = MESSAGE_TYPES.MINEBOY;
  const expiresAt = now + (config.duration * 1000); // 24 hours
  
  await db.prepare(`
    INSERT INTO paid_messages (
      id, wallet, message, tx_hash, amount_wei,
      created_at, expires_at, status, message_type,
      color, banner_duration_sec, priority
    ) VALUES (
      @id, @wallet, @message, @tx_hash, @amount_wei,
      @created_at, @expires_at, @status, @message_type,
      @color, @banner_duration_sec, @priority
    )
  `).run({
    id,
    wallet: 'admin',
    message: text,
    tx_hash: `admin-${id}`, // pseudo tx_hash for admin messages
    amount_wei: '0',
    created_at: now,
    expires_at: expiresAt,
    status: 'active',
    message_type: 'MINEBOY',
    color: config.color,
    banner_duration_sec: config.duration,
    priority: 0,
  });
  
  console.log(`[MineboyMessages] Added admin message: "${text.substring(0, 50)}..."`);
  return id;
}

/**
 * Remove a MINEBOY admin message
 */
export async function removeMineboyMessage(id: string): Promise<boolean> {
  const db = getDB();
  const result = await db.prepare(`
    UPDATE paid_messages 
    SET status = 'removed'
    WHERE id = @id AND message_type = 'MINEBOY'
  `).run({ id });
  
  return result.changes > 0;
}

/**
 * Get all active MINEBOY messages
 */
export async function getMineboyMessages(): Promise<Array<{
  id: string;
  message: string;
  created_at: number;
  expires_at: number;
}>> {
  const db = getDB();
  return await db.prepare(`
    SELECT id, message, created_at, expires_at
    FROM paid_messages
    WHERE message_type = 'MINEBOY' 
      AND status = 'active'
      AND expires_at > @now
    ORDER BY created_at DESC
  `).all({ now: Date.now() }) as any[];
}

/**
 * Legacy in-memory message store (kept for backward compatibility)
 * Now just a wrapper around PostgreSQL
 */
class MessageStore {
  async getMessages(): Promise<string[]> {
    const messages = await getMineboyMessages();
    return messages.map(m => `MineBoy: ${m.message}`);
  }

  async addMessage(text: string): Promise<string> {
    return await addMineboyMessage(text);
  }

  async removeMessage(id: string): Promise<void> {
    await removeMineboyMessage(id);
  }

  async getAllMessages(): Promise<Array<{ id: string; text: string; addedAt: number }>> {
    const messages = await getMineboyMessages();
    return messages.map(m => ({
      id: m.id,
      text: m.message,
      addedAt: m.created_at,
    }));
  }
}

export const messageStore = new MessageStore();