/**
 * Check LP wallet balance
 * Simple script to see how much APE has accumulated
 */
import { ethers } from 'ethers';

const LP_WALLET = '0xB8bb2C7fDE8FfB6fe2B71d401E5DD2612Fc6A043';
const RPC_URL = 'https://apechain.calderachain.xyz/http';

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const balance = await provider.getBalance(LP_WALLET);
  const balanceAPE = ethers.formatEther(balance);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏦 LP WALLET BALANCE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Address: ${LP_WALLET}`);
  console.log(`Balance: ${balanceAPE} APE`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('💡 Potential Uses:');
  console.log('  1. Add liquidity to MNESTR/APE pool');
  console.log('  2. Prize/giveaway wallet for contests');
  console.log('  3. Strategic reserve for market making');
  console.log('  4. Redirect to treasury for more burns');
  console.log('');
  
  // Estimate accumulation rate (0.0010 APE per claim)
  const estimatedClaims = Math.floor(parseFloat(balanceAPE) / 0.0010);
  console.log(`📊 Estimated claims since last use: ~${estimatedClaims.toLocaleString()}`);
}

main().catch(console.error);
