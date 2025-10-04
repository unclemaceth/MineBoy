/**
 * Pickaxe Metadata Cache
 * 
 * Fetches and caches pickaxe metadata from Alchemy to determine hashrate.
 * This is the SERVER-SIDE source of truth for pickaxe capabilities.
 */

import NodeCache from 'node-cache';
import { getNFTMetadata } from './alchemy.js';

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY!;
const PICKAXE_CONTRACT = '0x3322b37349AeFD6F50F7909B641f2177c1D34D25';

// Cache pickaxe metadata for 1 hour (metadata rarely changes)
const pickaxeCache = new NodeCache({ stdTTL: 3600 });

/**
 * Hashrate mapping based on pickaxe type
 * SERVER-SIDE SOURCE OF TRUTH - must match contract multipliers
 */
const HASHRATE_MAP: Record<string, number> = {
  "The DripAxe": 8000,
  "The Morgul PickHammer": 7000,
  "Blue Steel": 6000,
  "The Blue Steel": 6000, // Alternative naming
};

const BASE_HASHRATE = 5000; // Default for unknown/old cartridges

interface PickaxeMetadata {
  type: string;
  multiplier: number;
  oresMined: number;
  goldMined: number;
}

/**
 * Parse pickaxe metadata from Alchemy response
 */
function parsePickaxeMetadata(attributes: any[]): PickaxeMetadata | null {
  if (!attributes || !Array.isArray(attributes)) return null;

  let type = "";
  let multiplier = 0;
  let oresMined = 0;
  let goldMined = 0;

  for (const attr of attributes) {
    if (attr.trait_type === "Type") {
      type = attr.value;
    } else if (attr.trait_type === "Multiplier") {
      multiplier = Number(attr.value) || 0;
    } else if (attr.trait_type === "Ores Mined") {
      oresMined = Number(attr.value) || 0;
    } else if (attr.trait_type === "Gold Mined") {
      goldMined = Number(attr.value) || 0;
    }
  }

  if (!type) return null;

  return {
    type,
    multiplier,
    oresMined,
    goldMined,
  };
}

/**
 * Get hashrate for a specific pickaxe NFT
 * 
 * @param contract NFT contract address
 * @param tokenId NFT token ID
 * @returns Hashrate in H/s (5000, 6000, 7000, or 8000)
 */
export async function getPickaxeHashRate(contract: string, tokenId: number): Promise<number> {
  const cacheKey = `${contract.toLowerCase()}:${tokenId}`;
  
  // Check cache first
  const cached = pickaxeCache.get<number>(cacheKey);
  if (cached) {
    console.log(`[PickaxeCache] Cache hit: ${cacheKey} -> ${cached} H/s`);
    return cached;
  }
  
  // Only fetch metadata for pickaxe contract
  if (contract.toLowerCase() !== PICKAXE_CONTRACT.toLowerCase()) {
    console.log(`[PickaxeCache] Non-pickaxe contract: ${contract} -> ${BASE_HASHRATE} H/s`);
    pickaxeCache.set(cacheKey, BASE_HASHRATE);
    return BASE_HASHRATE;
  }
  
  try {
    console.log(`[PickaxeCache] Fetching metadata for ${contract}:${tokenId}...`);
    
    // Fetch metadata from Alchemy
    const metadata = await getNFTMetadata(PICKAXE_CONTRACT, tokenId);
    
    if (!metadata || !metadata.attributes) {
      console.warn(`[PickaxeCache] No metadata found for ${cacheKey}, using base rate`);
      pickaxeCache.set(cacheKey, BASE_HASHRATE);
      return BASE_HASHRATE;
    }
    
    // Parse pickaxe type from metadata
    const pickaxeData = parsePickaxeMetadata(metadata.attributes);
    
    if (!pickaxeData || !pickaxeData.type) {
      console.warn(`[PickaxeCache] No type found in metadata for ${cacheKey}, using base rate`);
      pickaxeCache.set(cacheKey, BASE_HASHRATE);
      return BASE_HASHRATE;
    }
    
    // Map type to hashrate
    const hashRate = HASHRATE_MAP[pickaxeData.type] ?? BASE_HASHRATE;
    
    console.log(`[PickaxeCache] ${cacheKey} -> Type: ${pickaxeData.type}, HashRate: ${hashRate} H/s`);
    
    // Cache result
    pickaxeCache.set(cacheKey, hashRate);
    
    return hashRate;
  } catch (error) {
    console.error(`[PickaxeCache] Error fetching metadata for ${cacheKey}:`, error);
    // On error, use base rate and cache it temporarily
    pickaxeCache.set(cacheKey, BASE_HASHRATE, 60); // Cache for 1 minute on error
    return BASE_HASHRATE;
  }
}

/**
 * Preload pickaxe metadata into cache (optional optimization)
 */
export async function preloadPickaxeCache(contract: string, tokenIds: number[]): Promise<void> {
  console.log(`[PickaxeCache] Preloading ${tokenIds.length} pickaxes...`);
  
  const promises = tokenIds.map(tokenId => 
    getPickaxeHashRate(contract, tokenId).catch(err => {
      console.error(`[PickaxeCache] Failed to preload ${contract}:${tokenId}:`, err);
    })
  );
  
  await Promise.all(promises);
  console.log(`[PickaxeCache] Preload complete`);
}

/**
 * Clear cache (for testing or manual refresh)
 */
export function clearPickaxeCache(): void {
  pickaxeCache.flushAll();
  console.log('[PickaxeCache] Cache cleared');
}
