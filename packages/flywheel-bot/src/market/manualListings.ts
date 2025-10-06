import { getCheapestListing as getMagicEdenListing } from './magiceden.js';

/**
 * Listing data structure
 */
export type ManualListing = {
  to: string;          // Market router address
  data: string;        // Transaction calldata (hex)
  valueWei: string;    // Price in wei (as string)
  tokenId: string;     // NFT token ID
  priceNative: string; // Price in APE (human-readable, for logs)
};

/**
 * Get the next listing to buy
 * 
 * Uses Magic Eden API - WORKS on ApeChain!
 */
export async function getNextListing(): Promise<ManualListing | null> {
  // Use Magic Eden API to get cheapest listing
  const listing = await getMagicEdenListing();
  
  if (listing) {
    console.log(`[Listings] Found listing: Token #${listing.tokenId} for ${listing.priceNative} APE`);
    return listing;
  }
  
  console.log('[Listings] No listings available right now');
  return null;
}
