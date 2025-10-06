import { flywheel } from '../src/wallets.js';
import { Contract } from 'ethers';
import { cfg } from '../src/config.js';

async function main() {
  const nft = new Contract(
    cfg.npc,
    ['function ownerOf(uint256) view returns (address)'],
    flywheel
  );
  
  const flywheelAddr = await flywheel.getAddress();
  
  console.log('\n📋 Checking NPC ownership...\n');
  
  for (const tokenId of ['83', '1077']) {
    try {
      const owner = await nft.ownerOf(tokenId);
      const isOwned = owner.toLowerCase() === flywheelAddr.toLowerCase();
      
      console.log(`NPC #${tokenId}:`);
      console.log(`   Owner: ${owner}`);
      console.log(`   ${isOwned ? '✅ Owned by flywheel' : '❌ NOT owned by flywheel'}`);
      console.log();
    } catch (error: any) {
      console.log(`NPC #${tokenId}: ❌ Error - ${error.message}\n`);
    }
  }
}

main().catch(console.error);
