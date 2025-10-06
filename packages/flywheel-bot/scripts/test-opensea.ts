import 'dotenv/config';
import { getCheapestListing, getFloorPrice } from '../src/market/opensea.js';
import { cfg } from '../src/config.js';

/**
 * Test OpenSea API integration
 */

async function main() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║   TESTING OPENSEA API                     ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  console.log(`NPC Collection: ${cfg.npc}`);
  console.log(`OpenSea API Key: ${process.env.OPENSEA_API_KEY?.slice(0, 10)}...\n`);

  // Test 1: Get floor price
  console.log('📊 Test 1: Fetching floor price...');
  const floorPrice = await getFloorPrice();
  
  if (floorPrice) {
    console.log(`✅ Floor price: ${floorPrice} APE\n`);
  } else {
    console.log('⚠️  Could not get floor price (might not be available on OpenSea)\n');
  }

  // Test 2: Get cheapest listing
  console.log('📋 Test 2: Fetching cheapest listing...');
  const listing = await getCheapestListing();
  
  if (listing) {
    console.log('✅ Found listing!');
    console.log(`   Token ID: ${listing.tokenId}`);
    console.log(`   Price: ${listing.priceNative} APE`);
    console.log(`   To: ${listing.to}`);
    console.log(`   Data length: ${listing.data.length} chars`);
    console.log(`   Value (wei): ${listing.valueWei}\n`);
    
    console.log('🎉 SUCCESS! OpenSea API is working!\n');
    console.log('The bot can now:');
    console.log('✅ Automatically find cheapest NPCs');
    console.log('✅ Get transaction data to buy them');
    console.log('✅ Create listings when selling\n');
    
    console.log('Next step: Run the bot!');
    console.log('Command: npm run dev\n');
  } else {
    console.log('⚠️  No listings found\n');
    console.log('Possible reasons:');
    console.log('1. No NPCs are currently listed on OpenSea');
    console.log('2. OpenSea API key needs permissions for ApeChain');
    console.log('3. Collection is not indexed on OpenSea yet\n');
    
    console.log('📝 What to do:');
    console.log('1. Check if NPCs are listed on OpenSea marketplace');
    console.log('2. Verify OpenSea supports ApeChain');
    console.log('3. You can still test with manual listings\n');
  }
}

main().catch((e) => { 
  console.error('❌ Error:', e.message); 
  console.error(e);
  process.exit(1); 
});
