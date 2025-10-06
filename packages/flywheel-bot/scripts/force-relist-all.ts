/**
 * Force relist all owned NPCs to populate backend with full orders
 * Using PURE SEAPORT - NO MAGIC EDEN
 */
console.log('[DEBUG] Starting script...');

import { flywheel } from '../src/wallets.js';
console.log('[DEBUG] Imported wallet');

import { createListing } from '../src/market/seaport-builder.js';
console.log('[DEBUG] Imported seaport builder');

import { Contract } from 'ethers';
console.log('[DEBUG] Imported ethers');

import { cfg } from '../src/config.js';
console.log('[DEBUG] Imported config');

const ERC721_ABI = ['function ownerOf(uint256) view returns (address)'];

async function main() {
  console.log('🔍 Finding all owned NPCs...');
  
  const npcContract = new Contract(cfg.npc, ERC721_ABI, flywheel);
  const flywheelAddr = await flywheel.getAddress();
  const owned: string[] = [];
  
  // Check token range 1-2222
  for (let i = 1; i <= 2222; i++) {
    try {
      const owner = await npcContract.ownerOf(i);
      if (owner.toLowerCase() === flywheelAddr.toLowerCase()) {
        owned.push(String(i));
        console.log(`  ✅ Found NPC #${i}`);
      }
    } catch {
      // Token doesn't exist or not owned
    }
  }
  
  console.log(`\n📋 Found ${owned.length} owned NPCs`);
  
  if (owned.length === 0) {
    console.log('No NPCs to relist!');
    return;
  }
  
  // Relist each one at a slightly different price to ensure fresh listings
  const basePrice = 55.5;
  
  for (let i = 0; i < owned.length; i++) {
    const tokenId = owned[i];
    const price = (basePrice + (i * 0.1)).toFixed(1); // 55.5, 55.6, 55.7, etc.
    
    console.log(`\n📤 [${i + 1}/${owned.length}] Relisting NPC #${tokenId} at ${price} APE...`);
    
    try {
      const success = await createListing(flywheel, cfg.npc, tokenId, price);
      if (success) {
        console.log(`  ✅ Successfully relisted NPC #${tokenId}`);
      } else {
        console.log(`  ❌ Failed to relist NPC #${tokenId}`);
      }
    } catch (error: any) {
      console.error(`  ❌ Error relisting NPC #${tokenId}:`, error.message);
    }
    
    // Wait 2 seconds between listings to avoid rate limits
    if (i < owned.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n✅ All owned NPCs have been relisted!');
  console.log('   Full orders should now be stored in the backend.');
}

main().catch(console.error);
