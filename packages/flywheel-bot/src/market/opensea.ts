import axios from 'axios';
import { cfg } from '../config.js';
import { parseEther } from 'ethers';
import type { ManualListing } from './manualListings.js';

/**
 * OpenSea API Integration
 * 
 * Handles both:
 * 1. Fetching cheapest listings (for buying)
 * 2. Creating listings (for selling)
 */

const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY;
const OPENSEA_API_BASE = 'https://api.opensea.io/api/v2';

// ApeChain chain identifier for OpenSea
const APECHAIN_IDENTIFIER = 'apechain';

interface OpenSeaListing {
  order_hash: string;
  protocol_data: {
    parameters: any;
  };
  protocol_address: string;
  current_price: string;
  maker: {
    address: string;
  };
}

/**
 * Get the cheapest listing for an NFT from the collection
 */
export async function getCheapestListing(): Promise<ManualListing | null> {
  if (!OPENSEA_API_KEY) {
    console.error('[OpenSea] No API key found!');
    return null;
  }

  try {
    console.log('[OpenSea] Fetching listings...');
    
    // Get listings for the NPC collection
    const url = `${OPENSEA_API_BASE}/listings/collection/${APECHAIN_IDENTIFIER}/${cfg.npc}`;
    
    const response = await axios.get(url, {
      headers: {
        'X-API-KEY': OPENSEA_API_KEY,
        'Accept': 'application/json'
      },
      params: {
        limit: 10,
        order_by: 'eth_price',
        order_direction: 'asc'
      }
    });

    const listings = response.data?.listings || [];
    
    if (listings.length === 0) {
      console.log('[OpenSea] No listings found');
      return null;
    }

    // Get the cheapest one
    const cheapest = listings[0];
    
    // Extract token ID from the listing
    const tokenId = cheapest.protocol_data?.parameters?.offer?.[0]?.identifierOrCriteria || 
                   cheapest.protocol_data?.parameters?.consideration?.[0]?.identifierOrCriteria;
    
    if (!tokenId) {
      console.error('[OpenSea] Could not extract token ID from listing');
      return null;
    }

    const priceWei = cheapest.current_price || cheapest.protocol_data?.parameters?.consideration?.[0]?.startAmount;
    const priceNative = (Number(priceWei) / 1e18).toFixed(6);

    console.log(`[OpenSea] Found listing: Token #${tokenId} for ${priceNative} APE`);

    // Now we need to get the fulfillment data
    // OpenSea provides an endpoint to generate the transaction data
    const fulfillmentUrl = `${OPENSEA_API_BASE}/listings/fulfillment_data`;
    
    const fulfillmentResponse = await axios.post(fulfillmentUrl, {
      listing: {
        hash: cheapest.order_hash,
        chain: APECHAIN_IDENTIFIER,
        protocol_address: cheapest.protocol_address
      },
      fulfiller: {
        address: cfg.flywheelAddr // Bot's wallet address
      }
    }, {
      headers: {
        'X-API-KEY': OPENSEA_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    const fulfillmentData = fulfillmentResponse.data?.fulfillment_data;
    
    if (!fulfillmentData) {
      console.error('[OpenSea] Could not get fulfillment data');
      return null;
    }

    return {
      to: fulfillmentData.transaction.to,
      data: fulfillmentData.transaction.input_data.data,
      valueWei: fulfillmentData.transaction.value,
      tokenId: tokenId,
      priceNative: priceNative
    };

  } catch (error: any) {
    console.error('[OpenSea] Error fetching listings:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Create a listing on OpenSea
 * 
 * @param tokenId - The NFT token ID to list
 * @param priceAPE - The price in APE (human readable)
 */
export async function createListing(tokenId: string, priceAPE: string): Promise<boolean> {
  if (!OPENSEA_API_KEY) {
    console.error('[OpenSea] No API key found!');
    return false;
  }

  try {
    console.log(`[OpenSea] Creating listing for token #${tokenId} at ${priceAPE} APE...`);

    // Build the listing request
    const priceWei = parseEther(priceAPE).toString();
    const expirationTime = Math.floor(Date.now() / 1000) + (7 * 24 * 3600); // 7 days

    const url = `${OPENSEA_API_BASE}/orders/${APECHAIN_IDENTIFIER}/seaport/listings`;

    const listingPayload = {
      parameters: {
        offerer: cfg.flywheelAddr,
        offer: [
          {
            itemType: 2, // ERC721
            token: cfg.npc,
            identifierOrCriteria: tokenId,
            startAmount: "1",
            endAmount: "1"
          }
        ],
        consideration: [
          {
            itemType: 0, // Native token (APE)
            token: "0x0000000000000000000000000000000000000000",
            identifierOrCriteria: "0",
            startAmount: priceWei,
            endAmount: priceWei,
            recipient: cfg.flywheelAddr
          }
        ],
        startTime: Math.floor(Date.now() / 1000).toString(),
        endTime: expirationTime.toString(),
        orderType: 0, // FULL_OPEN
        zone: "0x0000000000000000000000000000000000000000",
        zoneHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
        salt: Math.floor(Math.random() * 1000000000).toString(),
        conduitKey: "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000",
        totalOriginalConsiderationItems: 1,
        counter: "0"
      },
      protocol_address: cfg.marketRouter // Seaport protocol address
    };

    const response = await axios.post(url, listingPayload, {
      headers: {
        'X-API-KEY': OPENSEA_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (response.data?.order) {
      console.log(`[OpenSea] ✅ Listing created! Order hash: ${response.data.order.order_hash}`);
      return true;
    }

    console.error('[OpenSea] Failed to create listing:', response.data);
    return false;

  } catch (error: any) {
    console.error('[OpenSea] Error creating listing:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Get floor price for the collection
 */
export async function getFloorPrice(): Promise<string | null> {
  if (!OPENSEA_API_KEY) {
    return null;
  }

  try {
    const url = `${OPENSEA_API_BASE}/chain/${APECHAIN_IDENTIFIER}/contract/${cfg.npc}`;
    
    const response = await axios.get(url, {
      headers: {
        'X-API-KEY': OPENSEA_API_KEY
      }
    });

    const floorPrice = response.data?.collection?.stats?.floor_price;
    return floorPrice ? floorPrice.toString() : null;

  } catch (error: any) {
    console.error('[OpenSea] Error fetching floor price:', error.message);
    return null;
  }
}
