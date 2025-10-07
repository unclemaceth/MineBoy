import { cfg } from "./config.js";
import { flywheel } from "./wallets.js";
import { getNextListing } from "./market/manualListings.js";
import { canAfford, executeListingRaw, verifyOwnership } from "./market/buy.js";
import { relistAtMarkup } from "./market/list.js";
import { parseEther } from "ethers";
import { setTimeout as wait } from "timers/promises";
import { checkRateLimit } from "./redis.js";
import { alertInfo, alertWarning, alertSuccess, alertErrorDeduped } from "./utils/discord.js";
import { recordBuy, recordBuyFailure, recordListFailure } from "./utils/health.js";
import { recordDailyBuy, recordDailySale, recordDailyFailure } from "./utils/dailySummary.js";

/**
 * NPC Flywheel Trading Bot
 * 
 * Trading loop:
 * 1. Checks for cheap NPC listings on Magic Eden
 * 2. Buys them if we have enough APE
 * 3. Relists at +20% markup (proceeds → treasury wallet)
 * 4. Continues to next purchase (60s delay)
 * 
 * Treasury poller (runs in parallel):
 * - Checks treasury balance every 30s
 * - When ≥1 APE detected: swaps 99% → MNESTR → burns 🔥
 * - Sends 1% APE to trading wallet for gas
 */

// Daily spend tracking
let spentTodayWei = 0n;
let currentDay = new Date().getUTCDate();

function resetDailyIfNeeded() {
  const d = new Date().getUTCDate();
  if (d !== currentDay) {
    console.log(`[Daily] New day - resetting spend counter (was ${spentTodayWei} wei)`);
    currentDay = d;
    spentTodayWei = 0n;
  }
}

function capHit(amountWei: bigint): boolean {
  const capWei = BigInt(parseEther(String(cfg.knobs.dailySpendCapApe)).toString());
  return (spentTodayWei + amountWei) > capWei;
}

async function checkOwnedNPCs(): Promise<string[]> {
  // Check if we own any NPCs that need to be listed
  // For now, we'll just return empty - can enhance later with on-chain checks
  return [];
}

/**
 * Security Fix #4: Emergency stop mechanism
 * Check if emergency stop is enabled
 * Set EMERGENCY_STOP=1 in Render env vars to halt the bot
 */
function shouldStop(): boolean {
  const emergencyStop = process.env.EMERGENCY_STOP || '0';
  return emergencyStop === '1' || emergencyStop === 'true' || emergencyStop === 'TRUE';
}

async function loop() {
  console.log(`
╔════════════════════════════════════════════════════════╗
║       NPC FLYWHEEL BOT - STARTING                      ║
╚════════════════════════════════════════════════════════╝
`);
  console.log(`[Init] Flywheel address: ${await flywheel.getAddress()}`);
  console.log(`[Init] Daily spend cap: ${cfg.knobs.dailySpendCapApe} APE`);
  console.log(`[Init] Markup: +${cfg.knobs.markupBps / 100}%`);
  console.log(`[Init] Burn rate: 99%\n`);

  // Check for any NFTs we already own and try to list them
  console.log('[Resume] Checking for NFTs already owned...');
  const ownedTokenIds = await checkOwnedNPCs();
  
  for (const tokenId of ownedTokenIds) {
    console.log(`[Resume] Found owned tokenId=${tokenId}, attempting to list...`);
    try {
      const ask = await relistAtMarkup({
        tokenId,
        costNative: "0", // Unknown cost, just list at current floor + markup
        markupBps: cfg.knobs.markupBps
      });
      console.log(`[Resume:OK] Listed tokenId=${tokenId} at ${ask} APE`);
    } catch (e) {
      console.error(`[Resume:FAIL] Could not list tokenId=${tokenId}:`, e);
    }
  }

  while (true) {
    try {
      // Security Fix #4: Check emergency stop
      if (shouldStop()) {
        console.warn('⚠️  [EMERGENCY STOP] Bot is paused. Set EMERGENCY_STOP=0 to resume.');
        await alertWarning('Emergency Stop Enabled', {
          'Status': 'Bot paused',
          'Action': 'Set EMERGENCY_STOP=0 to resume',
        });
        await wait(10000); // Wait 10s before checking again
        continue;
      }
      
      resetDailyIfNeeded();

      // Get next listing from your source
      const listing = await getNextListing();
      if (!listing) {
        // No listings available right now
        await wait(10_000); // Wait 10 seconds
        continue;
      }

      // Check daily spend cap
      if (capHit(BigInt(listing.valueWei))) {
        console.log(`[Cap] Daily spend cap reached (${cfg.knobs.dailySpendCapApe} APE). Waiting...`);
        await wait(60_000); // Wait 1 minute
        continue;
      }

      // Check if we can afford it (with buffer for gas)
      const afford = await canAfford(listing.priceNative, cfg.knobs.buyBufferBps);
      if (!afford) {
        console.log(`[Funds] Not enough APE to buy @ ${listing.priceNative} APE. Waiting...`);
        await wait(30_000); // Wait 30 seconds
        continue;
      }

      // ============ BUY ============
      // Security Fix #8: Rate limit purchases (max 1 per minute)
      const purchaseLimit = await checkRateLimit('flywheel:purchases', 1, 60);
      if (!purchaseLimit.allowed) {
        console.log(`[RateLimit] Purchase rate limit hit (${purchaseLimit.current}/${purchaseLimit.limit} per minute). Waiting...`);
        await wait(30_000); // Wait 30s and try again
        continue;
      }
      
      console.log(`\n[Buy] Attempting to buy tokenId=${listing.tokenId} for ${listing.priceNative} APE`);
      const rc = await executeListingRaw({
        to: listing.to,
        data: listing.data,
        valueWei: listing.valueWei
      });
      console.log(`[Buy:OK] tx=${rc?.hash}`);
      spentTodayWei += BigInt(listing.valueWei);

      // Verify we received the NFT
      const gotIt = await verifyOwnership(listing.tokenId);
      if (!gotIt) {
        console.warn(`[Verify:FAIL] Did not receive tokenId=${listing.tokenId}!`);
        recordBuyFailure();
        recordDailyFailure('buy_verify');
        await alertErrorDeduped('Buy verification failed', {
          'Token ID': listing.tokenId,
          'Price': listing.priceNative + ' APE',
          'Transaction': rc?.hash || 'N/A',
        });
        await wait(10_000);
        continue;
      }
      console.log(`[Verify:OK] We now own tokenId=${listing.tokenId}`);
      
      // Record successful buy
      recordBuy();
      recordDailyBuy(Number(listing.priceNative));
      await alertSuccess('NPC Purchased', {
        'Token ID': listing.tokenId,
        'Price': listing.priceNative + ' APE',
        'Transaction': `https://apescan.io/tx/${rc?.hash}`,
      });

      // ============ RELIST ============
      // Security Fix #8: Rate limit listings (max 10 per hour)
      const listingLimit = await checkRateLimit('flywheel:listings', 10, 3600);
      if (!listingLimit.allowed) {
        console.log(`[RateLimit] Listing rate limit hit (${listingLimit.current}/${listingLimit.limit} per hour). Deferring...`);
        // Don't block the loop - we'll try to list it later
      } else {
        const ask = await relistAtMarkup({
          tokenId: listing.tokenId,
          costNative: listing.priceNative,
          markupBps: cfg.knobs.markupBps
        });
        console.log(`[List:OK] Listed tokenId=${listing.tokenId} at ${ask} APE`);
        console.log(`[List:OK] When sold, proceeds will go to treasury → auto-burn! 🔥`);
      }
      
      // ============ CONTINUE TO NEXT BUY ============
      // No need to wait for sale - treasury handles burns automatically!
      // Just wait a bit before buying next one to avoid rapid-fire purchases
      console.log(`[Bot] Waiting 60s before next purchase cycle...\n`);
      await wait(60_000);
      
    } catch (e: any) {
      console.error(`[Error]`, e);
      
      // Alert error to Discord (de-duped)
      await alertErrorDeduped('Bot loop error', {
        'Error': e?.message || String(e),
        'Type': e?.code || 'unknown',
      });
      
      await wait(15_000); // Wait 15 seconds before retry
    }
  }
}

// Start the treasury balance poller (auto-burns when APE detected)
import { startTreasuryPoller } from './treasury/poller.js';
startTreasuryPoller().catch(console.error);

// Start the daily summary job (posts stats to Discord at UTC midnight)
import { startDailySummaryJob } from './utils/dailySummary.js';
startDailySummaryJob().catch(console.error);

// Send startup notification
alertInfo('Flywheel Bot Started', `Emergency Stop: ${process.env.EMERGENCY_STOP === '1' ? '🛑 ENABLED' : '✅ Disabled'}\nDaily Cap: ${cfg.knobs.dailySpendCapApe} APE\nMarkup: +${cfg.knobs.markupBps / 100}%`).catch(console.error);

// Start the trading bot
loop().catch(console.error);
