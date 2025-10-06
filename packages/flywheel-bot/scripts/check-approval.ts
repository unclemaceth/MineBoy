import { flywheel } from '../src/wallets.js';
import { Contract } from 'ethers';
import { cfg } from '../src/config.js';

const SEAPORT = '0x0000000000000068F116a894984e2DB1123eB395';
const CONDUIT = '0x0000000000000000000000000000000000000000'; // We might need the actual conduit

async function main() {
  const nft = new Contract(
    cfg.npc,
    ['function isApprovedForAll(address,address) view returns (bool)'],
    flywheel
  );
  
  const flywheelAddr = await flywheel.getAddress();
  const approvedForSeaport = await nft.isApprovedForAll(flywheelAddr, SEAPORT);
  
  console.log(`Flywheel wallet: ${flywheelAddr}`);
  console.log(`NPC contract: ${cfg.npc}`);
  console.log(`Approved for Seaport: ${approvedForSeaport}`);
}

main().catch(console.error);
