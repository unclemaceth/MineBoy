import { cfg } from "../config.js";
import { flywheel } from '../wallets.js';
import { createListing } from './seaport-builder.js';

/**
 * Relist an NFT at a markup
 * 
 * Uses Seaport 1.6 directly - proceeds go to treasury wallet for burning
 */
export async function relistAtMarkup({
  tokenId,
  costNative,
  markupBps
}: { tokenId: string; costNative: string; markupBps: number; }) {
  const ask = (Number(costNative) * (1 + markupBps / 10000)).toFixed(6);
  
  console.log(`[Relist] Creating listing for tokenId=${tokenId} at ${ask} APE (+${markupBps / 100}% from ${costNative})`);
  console.log(`[Relist] Proceeds will go to treasury wallet: ${cfg.treasuryAddr}`);
  
  // Create listing via Seaport (sends proceeds to treasury for burning)
  const success = await createListing(
    flywheel,
    cfg.npc,
    tokenId,
    ask,
    cfg.treasuryAddr // ← Treasury receives sale proceeds
  );
  
  if (success) {
    console.log(`[Relist:OK] Successfully listed tokenId=${tokenId} at ${ask} APE`);
  } else {
    console.error(`[Relist:FAIL] Failed to create listing for tokenId=${tokenId}`);
  }
  
  return ask;
}
