#!/usr/bin/env tsx
/**
 * Emergency script to list NFTs the bot already owns
 */

import { flywheel } from '../src/wallets.js';
import { relistAtMarkup } from '../src/market/list.js';
import { cfg } from '../src/config.js';

const OWNED_TOKEN_IDS = ['1077', '83']; // NFTs we know the bot owns

async function main() {
  console.log('🔧 Manually listing owned NPCs...\n');
  console.log(`Flywheel: ${await flywheel.getAddress()}\n`);

  for (const tokenId of OWNED_TOKEN_IDS) {
    console.log(`\n📝 Listing tokenId #${tokenId}...`);
    
    try {
      const ask = await relistAtMarkup({
        tokenId,
        costNative: "46.22", // Approximate cost
        markupBps: cfg.knobs.markupBps
      });
      
      console.log(`✅ SUCCESS! Listed #${tokenId} at ${ask} APE`);
    } catch (error: any) {
      console.error(`❌ FAILED to list #${tokenId}:`, error.message || error);
    }
  }

  console.log('\n🏁 Done!');
}

main().catch(console.error);
