/**
 * Treasury Balance Poller
 * 
 * Checks treasury wallet balance periodically and executes burn when APE is detected
 */

import { formatEther } from 'ethers';
import { treasury } from '../wallets.js';
import { executeBurn } from './burn.js';
import { acquireLock, releaseLock, hasLock } from '../redis.js';

const POLL_INTERVAL_MS = 30_000; // 30 seconds
const MIN_APE_TO_BURN = '2.0'; // Minimum 2 APE to trigger burn (need 0.5 for gas + 1.5 to swap)
const BURN_LOCK_KEY = 'flywheel:burn:lock';
const BURN_LOCK_TTL = 600; // 10 minutes max burn time

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
      // Security Fix #6: Check persistent Redis lock (prevents double-burns on restart)
      const lockHeld = await hasLock(BURN_LOCK_KEY);
      if (lockHeld) {
        console.log(`[Treasury Poller] Burn already in progress (locked)`);
        return;
      }

      // Check treasury balance
      const balance = await treasury.provider!.getBalance(treasuryAddr);
      const balanceAPE = formatEther(balance);

      // Only log when there's a meaningful balance
      if (Number(balanceAPE) > 0.01) {
        console.log(`[Treasury Poller] Balance: ${balanceAPE} APE`);
      }

      // Security Fix #7: Balance validation - skip if balance too low
      if (Number(balanceAPE) < Number(MIN_APE_TO_BURN)) {
        return; // Not enough to burn
      }

      console.log(`\n[Treasury Poller] 🔥 Detected ${balanceAPE} APE in treasury - triggering burn!`);
      
      // Acquire lock
      const acquired = await acquireLock(BURN_LOCK_KEY, BURN_LOCK_TTL);
      if (!acquired) {
        console.log(`[Treasury Poller] Could not acquire burn lock (race condition)`);
        return;
      }
      
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
        await releaseLock(BURN_LOCK_KEY);
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
