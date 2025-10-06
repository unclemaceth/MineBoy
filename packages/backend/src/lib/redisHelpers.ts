import { getRedis } from '../redis.js';

/**
 * Acquire a lock, execute a function, then release
 * @param key - Lock key (automatically prefixed with "lock:")
 * @param ttlMs - Lock TTL in milliseconds
 * @param body - Function to execute while holding the lock
 * @throws Error if lock cannot be acquired
 */
export async function withLock<T>(
  key: string,
  ttlMs: number = 10_000,
  body: () => Promise<T>
): Promise<T> {
  const redis = getRedis();
  if (!redis) {
    // No Redis - just execute (fallback for dev)
    return await body();
  }

  const lockKey = `lock:${key}`;
  const ok = await redis.set(lockKey, '1', 'PX', ttlMs, 'NX');
  
  if (!ok) {
    throw new Error(`locked:${key}`);
  }

  try {
    return await body();
  } finally {
    await redis.del(lockKey).catch(() => {});
  }
}

/**
 * Check if a key is locked
 */
export async function isLocked(key: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  
  const lockKey = `lock:${key}`;
  const exists = await redis.exists(lockKey);
  return exists === 1;
}
