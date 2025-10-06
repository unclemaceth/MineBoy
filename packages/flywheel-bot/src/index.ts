import { cfg } from "./config.js";
import { flywheel } from "./wallets.js";
import { getNextListing } from "./market/manualListings.js";
import { canAfford, executeListingRaw, verifyOwnership } from "./market/buy.js";
import { relistAtMarkup } from "./market/list.js";
import { wasSold } from "./market/sale.js";
import { settleBurn99 } from "./settle/settle.js";
import { parseEther } from "ethers";
import { setTimeout as wait } from "timers/promises";

/**
 * NPC Flywheel Trading Bot
 * 
 * Main loop that:
 * 1. Checks for cheap NPC listings
 * 2. Buys them if we have enough APE
 * 3. Relists at +20% markup
 * 4. Waits for sale
 * 5. Burns 99% of proceeds into MNESTR
 * 6. Repeats forever
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
        await wait(10_000);
        continue;
      }
      console.log(`[Verify:OK] We now own tokenId=${listing.tokenId}`);

      // ============ RELIST ============
      const ask = await relistAtMarkup({
        tokenId: listing.tokenId,
        costNative: listing.priceNative,
        markupBps: cfg.knobs.markupBps
      });
      console.log(`[List:OK] Listed tokenId=${listing.tokenId} at ${ask} APE`);

      // ============ WATCH FOR SALE ============
      console.log(`[Watch] Monitoring tokenId=${listing.tokenId} for sale...`);
      let sold = false;
      for (let i = 0; i < 180; i++) { // ~30 min at 10s intervals
        await wait(10_000);
        sold = await wasSold(listing.tokenId);
        if (sold) {
          console.log(`[Watch:SOLD] tokenId=${listing.tokenId} has been sold!`);
          break;
        }
        // Log progress every minute
        if ((i + 1) % 6 === 0) {
          console.log(`[Watch] Still listed (${Math.floor((i + 1) / 6)} min elapsed)...`);
        }
      }

      if (!sold) {
        console.log(`[Watch:TIMEOUT] tokenId=${listing.tokenId} did not sell in 30 min`);
        continue;
      }

      // ============ SETTLE & BURN ============
      console.log(`\n[Settle] Processing sale proceeds...`);
      const res = await settleBurn99();
      console.log(`[Settle:OK] Burned ${res.burned} wei of MNESTR! 🔥\n`);
      
    } catch (e) {
      console.error(`[Error]`, e);
      await wait(15_000); // Wait 15 seconds before retry
    }
  }
}

// Start the bot
loop().catch(console.error);
