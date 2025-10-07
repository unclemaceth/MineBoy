/**
 * Redis connection for flywheel bot
 * Used for persistent locks and rate limiting
 */
import IORedis from 'ioredis';

const url = process.env.REDIS_URL;
let redis: IORedis | null = null;

export function getRedis(): IORedis | null {
  if (!url) {
    console.warn('[Redis] No REDIS_URL configured - running without persistent state');
    return null;
  }
  
  if (!redis) {
    redis = new IORedis(url, {
      tls: url.startsWith('rediss://') ? {} : undefined,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
    
    redis.on('error', (e) => console.error('[Redis] error', e));
    redis.on('ready', () => console.log('[Redis] ✅ Connected'));
    console.log('[Redis] Connecting...');
  }
  
  return redis;
}

/**
 * Acquire a lock with TTL
 * @returns true if lock acquired, false if already held
 */
export async function acquireLock(key: string, ttlSeconds: number = 300): Promise<boolean> {
  const r = getRedis();
  if (!r) return true; // Fail open if no Redis
  
  const result = await r.set(key, '1', 'EX', ttlSeconds, 'NX');
  return result === 'OK';
}

/**
 * Release a lock
 */
export async function releaseLock(key: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  
  await r.del(key);
}

/**
 * Check if a lock exists
 */
export async function hasLock(key: string): Promise<boolean> {
  const r = getRedis();
  if (!r) return false;
  
  const exists = await r.exists(key);
  return exists === 1;
}

/**
 * Rate limiting: check if an action is allowed
 * @param key Redis key for this rate limit
 * @param limit Max actions allowed
 * @param windowSeconds Time window in seconds
 * @returns true if action allowed, false if rate limit hit
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const r = getRedis();
  if (!r) return { allowed: true, current: 0, limit }; // Fail open if no Redis
  
  const current = await r.incr(key);
  
  if (current === 1) {
    // First request in window - set expiry
    await r.expire(key, windowSeconds);
  }
  
  return {
    allowed: current <= limit,
    current,
    limit
  };
}
