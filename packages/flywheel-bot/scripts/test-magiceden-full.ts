import 'dotenv/config';
import { getCheapestListing, getFloorPrice } from '../src/market/magiceden.js';
import { cfg } from '../src/config.js';

/**
 * Full test of Magic Eden integration
 */

async function main() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║   MAGIC EDEN - FULL INTEGRATION TEST     ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  console.log(`NPC Collection: ${cfg.npc}`);
  console.log(`Flywheel Wallet: ${cfg.flywheelAddr}\n`);

  // Test 1: Get floor price
  console.log('📊 Test 1: Getting floor price...');
  const floor = await getFloorPrice();
  if (floor) {
    console.log(`✅ Floor price: ${floor} APE\n`);
  } else {
    console.log('⚠️  Could not get floor price\n');
  }

  // Test 2: Get cheapest listing with execution data
  console.log('📋 Test 2: Getting cheapest listing with buy data...');
  const listing = await getCheapestListing();
  
  if (listing) {
    console.log('\n🎉 SUCCESS! Magic Eden returned complete buy data!');
    console.log('\n📦 Listing Details:');
    console.log(`   Token ID: ${listing.tokenId}`);
    console.log(`   Price: ${listing.priceNative} APE`);
    console.log(`   Price (wei): ${listing.valueWei}`);
    console.log(`   To: ${listing.to}`);
    console.log(`   Data: ${listing.data.slice(0, 66)}...`);
    console.log(`   Data length: ${listing.data.length} chars`);
    
    console.log('\n✅ THE BOT CAN NOW:');
    console.log('   1. Automatically find cheapest NPCs');
    console.log('   2. Get transaction data to buy them');
    console.log('   3. Execute buys without any manual work!');
    
    console.log('\n🚀 NEXT STEP: Run the bot!');
    console.log('   Command: npm run dev');
    console.log('   The bot will automatically buy this NPC if it has enough APE!\n');
    
  } else {
    console.log('\n⚠️  No listings found or error occurred');
    console.log('Check the error messages above for details\n');
  }
}

main().catch((e) => { 
  console.error('❌ Error:', e.message); 
  process.exit(1); 
});
