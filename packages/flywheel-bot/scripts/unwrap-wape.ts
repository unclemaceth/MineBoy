/**
 * Unwrap WAPE back to native APE
 * Use this to recover stuck WAPE from failed swaps
 */

import { treasury } from '../src/wallets.js';
import { Contract, formatEther } from 'ethers';
import { cfg } from '../src/config.js';

const WAPE_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function withdraw(uint256) returns (bool)'
];

async function main() {
  console.log('\n🔄 Unwrapping WAPE → APE...\n');
  
  const treasuryAddr = await treasury.getAddress();
  console.log(`Treasury: ${treasuryAddr}`);
  
  const wape = new Contract(cfg.wape, WAPE_ABI, treasury);
  
  // Check WAPE balance
  const wapeBalance = await wape.balanceOf(treasuryAddr);
  console.log(`WAPE Balance: ${formatEther(wapeBalance)} WAPE\n`);
  
  if (wapeBalance === 0n) {
    console.log('✅ No WAPE to unwrap!');
    return;
  }
  
  // Unwrap all WAPE
  console.log(`Unwrapping ${formatEther(wapeBalance)} WAPE...`);
  const tx = await wape.withdraw(wapeBalance);
  console.log(`Tx submitted: ${tx.hash}`);
  
  await tx.wait();
  console.log(`✅ Unwrapped ${formatEther(wapeBalance)} WAPE → APE!`);
  
  // Check new APE balance
  const apeBalance = await treasury.provider!.getBalance(treasuryAddr);
  console.log(`\nTreasury APE Balance: ${formatEther(apeBalance)} APE\n`);
}

main().catch(console.error);

