import axios from 'axios';
import { cfg } from '../config.js';

/**
 * Alchemy NFT API Integration
 * 
 * Uses Alchemy's NFT API to find the cheapest NPC listings
 * across multiple marketplaces (OpenSea, Magic Eden, etc.)
 */

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
const ALCHEMY_URL = process.env.ALCHEMY_BASE_URL || 'https://apechain-mainnet.g.alchemy.com/v2/';

interface AlchemyListing {
  marketplace: string;
  collectionSlug?: string;
  contractAddress: string;
  tokenId: string;
  quantity: string;
  startAt: string;
  expiration: string;
  seller: {
    address: string;
  };
  payment: {
    quantity: string;
    tokenAddress: string;
    symbol: string;
    decimals: number;
  };
}

interface SimpleListing {
  tokenId: string;
  price: string;           // in APE (human readable)
  priceWei: string;        // in wei
  seller: string;
  marketplace: string;
  expiresAt: string;
}

/**
 * Get all active listings for the NPC collection
 */
export async function getActiveListings(): Promise<SimpleListing[]> {
  if (!ALCHEMY_KEY) {
    console.error('[Alchemy] No API key found!');
    return [];
  }

  try {
    // Alchemy NFT API v3 - Get NFT Sales endpoint
    const url = `${ALCHEMY_URL}${ALCHEMY_KEY}`;
    
    const response = await axios.post(url, {
      jsonrpc: '2.0',
      id: 1,
      method: 'alchemy_getNFTFloorPrice',
      params: [{
        contractAddress: cfg.npc
      }]
    });

    console.log('[Alchemy] Floor price response:', JSON.stringify(response.data, null, 2));

    // For now, return empty until we get proper listing data
    // Alchemy's NFT API primarily gives us floor prices and ownership data
    // For actual listing data, we may need to use marketplace APIs directly
    
    return [];
  } catch (error: any) {
    console.error('[Alchemy] Error fetching listings:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Get the cheapest active listing
 */
export async function getCheapestListing(): Promise<SimpleListing | null> {
  const listings = await getActiveListings();
  
  if (listings.length === 0) {
    return null;
  }

  // Sort by price (ascending)
  listings.sort((a, b) => Number(a.priceWei) - Number(b.priceWei));
  
  return listings[0];
}

/**
 * Get floor price for the collection
 */
export async function getFloorPrice(): Promise<string | null> {
  if (!ALCHEMY_KEY) {
    console.error('[Alchemy] No API key found!');
    return null;
  }

  try {
    const url = `${ALCHEMY_URL}${ALCHEMY_KEY}`;
    
    const response = await axios.post(url, {
      jsonrpc: '2.0',
      id: 1,
      method: 'alchemy_getNFTFloorPrice',
      params: [{
        contractAddress: cfg.npc
      }]
    });

    const data = response.data;
    
    if (data.result && data.result.openSea) {
      const floorPrice = data.result.openSea.floorPrice;
      console.log(`[Alchemy] Floor price: ${floorPrice} APE`);
      return floorPrice.toString();
    }

    return null;
  } catch (error: any) {
    console.error('[Alchemy] Error fetching floor price:', error.response?.data || error.message);
    return null;
  }
}
