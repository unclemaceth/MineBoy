/**
 * One-time cleanup: Remove meta-only orders from Redis
 */
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://red-d34lk9e3jp1c73as6ne0:6379';

async function main() {
  const redis = new Redis(REDIS_URL);
  
  console.log('🔍 Finding all market:order:* keys...');
  const keys = await redis.keys('market:order:*');
  console.log(`   Found ${keys.length} keys`);
  
  let deleted = 0;
  
  for (const key of keys) {
    const raw = await redis.get(key);
    if (!raw) continue;
    
    try {
      const v = JSON.parse(raw);
      if (!v?.order?.data?.signature && !v?.data?.signature) {
        console.log(`  ❌ Deleting meta-only key: ${key}`);
        await redis.del(key);
        deleted++;
      } else {
        console.log(`  ✅ Keeping full order: ${key}`);
      }
    } catch {
      console.log(`  ❌ Deleting unparsable key: ${key}`);
      await redis.del(key);
      deleted++;
    }
  }
  
  console.log(`\n✅ Cleanup complete! Deleted ${deleted} bad keys.`);
  await redis.quit();
}

main().catch(console.error);
