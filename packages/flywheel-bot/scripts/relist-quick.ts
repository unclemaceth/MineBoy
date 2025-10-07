/**
 * Quick relist for known owned NPCs
 * NO TOKEN SCANNING - just relist specific tokens
 */
import { flywheel } from '../src/wallets.js';
import { createListing } from '../src/market/seaport-builder.js';
import { cfg } from '../src/config.js';

async function main() {
  // Hardcoded list of owned tokens (update this when bot buys/sells)
  const ownedTokens = ['869', '1077'];
  
  console.log(`📋 Relisting ${ownedTokens.length} owned NPCs...`);
  
  const basePrice = 55.6;
  
  for (let i = 0; i < ownedTokens.length; i++) {
    const tokenId = ownedTokens[i];
    const price = (basePrice + (i * 0.1)).toFixed(1);
    
    console.log(`\n📤 [${i + 1}/${ownedTokens.length}] Relisting NPC #${tokenId} at ${price} APE...`);
    
    try {
      const success = await createListing(flywheel, cfg.npc, tokenId, price, cfg.treasuryAddr);
      if (success) {
        console.log(`  ✅ Successfully relisted NPC #${tokenId}`);
      } else {
        console.log(`  ❌ Failed to relist NPC #${tokenId}`);
      }
    } catch (error: any) {
      console.error(`  ❌ Error relisting NPC #${tokenId}:`, error.message);
    }
    
    // Wait 2 seconds between listings
    if (i < ownedTokens.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n✅ All owned NPCs have been relisted!');
}

main().catch(console.error);
