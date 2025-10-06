import 'dotenv/config';
import { getFloorPrice, getActiveListings } from '../src/market/alchemy.js';
import { cfg } from '../src/config.js';

/**
 * Test Alchemy NFT API to see what data we can get
 */

async function main() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║   TESTING ALCHEMY NFT API                 ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  console.log(`NPC Collection: ${cfg.npc}`);
  console.log(`Alchemy API Key: ${process.env.ALCHEMY_API_KEY?.slice(0, 10)}...\n`);

  // Test 1: Get floor price
  console.log('📊 Test 1: Fetching floor price...');
  const floorPrice = await getFloorPrice();
  
  if (floorPrice) {
    console.log(`✅ Floor price: ${floorPrice} APE\n`);
  } else {
    console.log('❌ Could not get floor price\n');
  }

  // Test 2: Try to get listings
  console.log('📋 Test 2: Fetching active listings...');
  const listings = await getActiveListings();
  
  if (listings.length > 0) {
    console.log(`✅ Found ${listings.length} listings:`);
    listings.slice(0, 3).forEach(listing => {
      console.log(`   - Token #${listing.tokenId}: ${listing.price} APE (${listing.marketplace})`);
    });
  } else {
    console.log('⚠️  No listings found (Alchemy NFT API may not provide marketplace listing data)\n');
  }

  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║   RESULTS & NEXT STEPS                    ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  console.log('What Alchemy Can Do:');
  console.log('✅ Get floor prices');
  console.log('✅ Get NFT metadata');
  console.log('✅ Get ownership data');
  console.log('✅ Get sales history\n');

  console.log('What Alchemy CANNOT Do:');
  console.log('❌ Get marketplace listings with buy calldata');
  console.log('❌ Create marketplace listings');
  console.log('❌ Provide transaction data to execute buys\n');

  console.log('📝 Recommendation:');
  console.log('For full automation, you need:');
  console.log('1. OpenSea API (for getting & creating listings)');
  console.log('2. OR Magic Eden API (for getting & creating listings)');
  console.log('3. OR Seaport SDK (for creating listings directly)\n');
}

main().catch((e) => { 
  console.error('❌ Error:', e.message); 
  process.exit(1); 
});
