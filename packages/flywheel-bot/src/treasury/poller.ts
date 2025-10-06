/**
 * Treasury Balance Poller
 * 
 * Checks treasury wallet balance periodically and executes burn when APE is detected
 */

import { formatEther } from 'ethers';
import { treasury } from '../wallets.js';
import { executeBurn } from './burn.js';

const POLL_INTERVAL_MS = 30_000; // 30 seconds
const MIN_APE_TO_BURN = '1.0'; // Minimum 1 APE to trigger burn

let burnInProgress = false;

/**
 * Start polling the treasury wallet balance
 */
export async function startTreasuryPoller() {
  console.log(`\n[Treasury Poller] Starting balance monitor...`);
  console.log(`[Treasury Poller] Checking every ${POLL_INTERVAL_MS / 1000}s for APE in treasury`);
  console.log(`[Treasury Poller] Min balance to trigger burn: ${MIN_APE_TO_BURN} APE\n`);

  const treasuryAddr = await treasury.getAddress();

  async function checkAndBurn() {
    try {
      // Skip if burn already in progress
      if (burnInProgress) {
        return;
      }

      // Check treasury balance
      const balance = await treasury.provider!.getBalance(treasuryAddr);
      const balanceAPE = formatEther(balance);

      // Only log when there's a meaningful balance
      if (Number(balanceAPE) > 0.01) {
        console.log(`[Treasury Poller] Balance: ${balanceAPE} APE`);
      }

      // Trigger burn if above minimum
      if (Number(balanceAPE) >= Number(MIN_APE_TO_BURN)) {
        console.log(`\n[Treasury Poller] 🔥 Detected ${balanceAPE} APE in treasury - triggering burn!`);
        
        burnInProgress = true;
        try {
          const result = await executeBurn();
          console.log(`\n[Treasury Poller] ✅ Burn completed successfully!`);
          console.log(`  APE received: ${result.apeReceived}`);
          console.log(`  APE swapped: ${result.apeForSwap}`);
          console.log(`  APE for gas: ${result.apeForGas}`);
          console.log(`  MNESTR burned: ${result.mnestrBurned} 🔥`);
          console.log(`  Tx: ${result.txHash}\n`);
        } catch (error: any) {
          console.error(`[Treasury Poller] ❌ Burn failed: ${error.message}`);
        } finally {
          burnInProgress = false;
        }
      }
    } catch (error: any) {
      console.error(`[Treasury Poller] Error checking balance: ${error.message}`);
    }
  }

  // Run immediately on start
  await checkAndBurn();

  // Then poll at interval
  setInterval(checkAndBurn, POLL_INTERVAL_MS);
}
