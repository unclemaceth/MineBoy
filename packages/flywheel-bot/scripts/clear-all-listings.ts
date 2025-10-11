/**
 * Clear ALL listings from backend Redis
 * Use this to remove old listings before relisting with correct treasury
 */
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://red-d34lk9e3jp1c73as6ne0:6379';

async function main() {
  const redis = new Redis(REDIS_URL);
  
  console.log('\n🗑️  Clearing all listings from backend Redis...\n');
  
  // Get all listed token IDs
  const tokenIds = await redis.smembers('market:listings');
  console.log(`📋 Found ${tokenIds.length} listings:\n`);
  
  if (tokenIds.length === 0) {
    console.log('✅ No listings to clear!');
    await redis.quit();
    return;
  }

  // Show what we're clearing
  for (const tokenId of tokenIds) {
    const raw = await redis.get(`market:order:${tokenId}`);
    if (raw) {
      try {
        const order = JSON.parse(raw);
        const priceAPE = (Number(order.priceWei) / 1e18).toFixed(2);
        console.log(`  - NPC #${tokenId}: ${priceAPE} APE`);
      } catch {
        console.log(`  - NPC #${tokenId}: (unable to parse)`);
      }
    }
  }

  console.log('\n🚀 Clearing...\n');

  // Delete all listing data
  const pipeline = redis.pipeline();
  for (const tokenId of tokenIds) {
    pipeline.srem('market:listings', tokenId);
    pipeline.del(`market:order:${tokenId}`);
  }
  await pipeline.exec();

  console.log(`✅ Cleared ${tokenIds.length} listings from backend!\n`);
  console.log('Now run: npm run force-relist-all\n');

  await redis.quit();
}

main().catch(console.error);

