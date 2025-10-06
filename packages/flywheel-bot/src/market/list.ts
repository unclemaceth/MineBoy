import { cfg } from "../config.js";
import { createListing as createMagicEdenListing } from './magiceden.js';

/**
 * Relist an NFT at a markup
 * 
 * Uses Magic Eden API - WORKS on ApeChain!
 */
export async function relistAtMarkup({
  tokenId,
  costNative,
  markupBps
}: { tokenId: string; costNative: string; markupBps: number; }) {
  const ask = (Number(costNative) * (1 + markupBps / 10000)).toFixed(6);
  
  console.log(`[Relist] Creating listing for tokenId=${tokenId} at ${ask} APE (+${markupBps / 100}% from ${costNative})`);
  
  // Create listing on Magic Eden
  const success = await createMagicEdenListing(tokenId, ask);
  
  if (success) {
    console.log(`[Relist:OK] Successfully listed tokenId=${tokenId} at ${ask} APE`);
  } else {
    console.error(`[Relist:FAIL] Failed to create listing for tokenId=${tokenId}`);
  }
  
  return ask;
}
