/**
 * Approve Seaport to transfer NPCs on behalf of the flywheel wallet
 * This is a one-time operation required before any sales can happen
 */

import { flywheel } from '../src/wallets.js';
import { Contract } from 'ethers';
import { cfg } from '../src/config.js';

const SEAPORT = '0x0000000000000068F116a894984e2DB1123eB395';
const CONDUIT = '0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000'; // OpenSea conduit

const ERC721_ABI = [
  'function setApprovalForAll(address operator, bool approved)',
  'function isApprovedForAll(address owner, address operator) view returns (bool)'
];

async function main() {
  console.log('🔐 Approving Seaport to transfer NPCs...\n');

  const nft = new Contract(cfg.npc, ERC721_ABI, flywheel);
  const flywheelAddr = await flywheel.getAddress();

  // Check current approval status
  const alreadyApproved = await nft.isApprovedForAll(flywheelAddr, SEAPORT);
  
  if (alreadyApproved) {
    console.log('✅ Already approved! No action needed.');
    return;
  }

  console.log(`Flywheel: ${flywheelAddr}`);
  console.log(`NPC Contract: ${cfg.npc}`);
  console.log(`Seaport: ${SEAPORT}`);
  console.log(`\n📝 Sending approval transaction...`);

  // Approve Seaport to transfer all NPCs
  const tx = await nft.setApprovalForAll(SEAPORT, true);
  console.log(`Transaction sent: ${tx.hash}`);
  
  console.log('⏳ Waiting for confirmation...');
  await tx.wait();
  
  console.log('✅ Approval confirmed!');
  console.log(`\n🎉 Seaport can now transfer NPCs from the flywheel wallet.`);
  console.log('   Orders can now be fulfilled!');
}

main().catch(console.error);
