import axios from 'axios';
import { cfg } from '../config.js';
import type { ManualListing } from './manualListings.js';

/**
 * Magic Eden API Integration
 * 
 * Magic Eden WORKS on ApeChain!
 * Can fetch listings with actual transaction data.
 */

const MAGIC_EDEN_API = 'https://api-mainnet.magiceden.dev/v3/rtp';
const MAGIC_EDEN_KEY = process.env.MAGICEDEN_API_KEY;

interface MagicEdenToken {
  token: {
    contract: string;
    tokenId: string;
    name: string;
    image: string;
  };
  market: {
    floorAsk: {
      id: string;
      price: {
        amount: {
          raw: string;
          decimal: number;
          native: number;
        };
      };
      maker: string;
      source: {
        domain: string;
      };
    };
  };
}

/**
 * Get cheapest NPC listing from Magic Eden
 */
export async function getCheapestListing(): Promise<ManualListing | null> {
  try {
    console.log('[MagicEden] Fetching NPC listings...');
    
    // Get tokens sorted by floor price
    const url = `${MAGIC_EDEN_API}/apechain/tokens/v7`;
    
    const headers: any = {
      'accept': '*/*'
    };
    
    if (MAGIC_EDEN_KEY) {
      headers['Authorization'] = `Bearer ${MAGIC_EDEN_KEY}`;
    }
    
    const response = await axios.get(url, {
      params: {
        collection: cfg.npc,
        sortBy: 'floorAskPrice',
        limit: 10
      },
      headers
    });

    const tokens = response.data?.tokens || [];
    
    if (tokens.length === 0) {
      console.log('[MagicEden] No listings found');
      return null;
    }

    // Find the first token with a valid floor ask
    const cheapest = tokens.find((t: MagicEdenToken) => t.market?.floorAsk);
    
    if (!cheapest || !cheapest.market?.floorAsk) {
      console.log('[MagicEden] No valid listings found');
      return null;
    }

    const tokenId = cheapest.token.tokenId;
    const priceNative = cheapest.market.floorAsk.price.amount.decimal.toFixed(6);
    const priceWei = cheapest.market.floorAsk.price.amount.raw;
    const orderId = cheapest.market.floorAsk.id;

    console.log(`[MagicEden] Found: Token #${tokenId} for ${priceNative} APE`);
    console.log(`[MagicEden] Order ID: ${orderId}`);

    // Now get the execution data to fulfill this order
    const executeUrl = `${MAGIC_EDEN_API}/apechain/execute/buy/v7`;
    
    const executeResponse = await axios.post(executeUrl, {
      items: [
        {
          token: `${cfg.npc}:${tokenId}`,
          quantity: 1
        }
      ],
      taker: cfg.flywheelAddr,
      onlyPath: false,
      skipBalanceCheck: true  // Skip balance check - we'll verify ourselves
    }, {
      headers
    });

    const steps = executeResponse.data?.steps || [];
    
    // Find the transaction step
    const txStep = steps.find((step: any) => 
      step.items?.some((item: any) => item.data?.to && item.data?.data)
    );

    if (!txStep) {
      console.error('[MagicEden] Could not get execution data');
      return null;
    }

    const txData = txStep.items[0]?.data;
    
    if (!txData || !txData.to || !txData.data) {
      console.error('[MagicEden] Invalid execution data');
      return null;
    }

    console.log(`[MagicEden] ✅ Got execution data`);

    return {
      to: txData.to,
      data: txData.data,
      valueWei: txData.value || priceWei,
      tokenId: tokenId,
      priceNative: priceNative
    };

  } catch (error: any) {
    console.error('[MagicEden] Error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Create a listing on Magic Eden
 * 
 * @param tokenId - The NFT token ID to list
 * @param priceAPE - The price in APE
 */
export async function createListing(tokenId: string, priceAPE: string): Promise<boolean> {
  try {
    console.log(`[MagicEden] Creating listing for token #${tokenId} at ${priceAPE} APE...`);

    const headers: any = {
      'accept': '*/*',
      'Content-Type': 'application/json'
    };
    
    if (MAGIC_EDEN_KEY) {
      headers['Authorization'] = `Bearer ${MAGIC_EDEN_KEY}`;
    }

    // Get listing creation data
    const url = `${MAGIC_EDEN_API}/apechain/execute/list/v5`;
    
    // Convert APE to wei
    const priceWei = (Number(priceAPE) * 1e18).toString();

    const response = await axios.post(url, {
      maker: cfg.flywheelAddr,
      source: "reservoir.tools",
      params: [
        {
          token: `${cfg.npc}:${tokenId}`,
          weiPrice: priceWei,
          orderKind: "seaport-v1.5",
          orderbook: "reservoir",
          automatedRoyalties: true,
          currency: "0x0000000000000000000000000000000000000000", // Native APE
          expirationTime: Math.floor(Date.now() / 1000) + (7 * 24 * 3600) // 7 days
        }
      ]
    }, {
      headers
    });

    const steps = response.data?.steps || [];
    
    if (steps.length === 0) {
      console.error('[MagicEden] No steps returned from listing API');
      return false;
    }

    // Execute each step (approvals, signatures, etc.)
    for (const step of steps) {
      console.log(`[MagicEden] Step: ${step.action || step.id}`);
      
      for (const item of step.items || []) {
        // If there's a transaction to execute (approval)
        if (item.data?.to && item.data?.data) {
          console.log(`[MagicEden] Executing transaction...`);
          const tx = await flywheel.sendTransaction({
            to: item.data.to,
            data: item.data.data,
            value: item.data.value || 0
          });
          console.log(`[MagicEden] Approval tx: ${tx.hash}`);
          await tx.wait();
        }
        
        // If there's a signature to create (listing order)
        if (item.data?.sign) {
          console.log(`[MagicEden] Signing listing order...`);
          const signature = await flywheel.signTypedData(
            item.data.sign.domain,
            item.data.sign.types,
            item.data.sign.value
          );
          
          // Post the signature back to Magic Eden
          const postUrl = item.data.post?.endpoint;
          if (postUrl) {
            console.log(`[MagicEden] Submitting signature to ${postUrl}...`);
            await axios.post(postUrl, {
              ...item.data.post?.body,
              signature
            }, { headers });
          }
        }
      }
    }
    
    console.log(`[MagicEden] ✅ Listing created and submitted!`);
    return true;

  } catch (error: any) {
    console.error('[MagicEden] Error creating listing:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Get floor price for NPC collection
 */
export async function getFloorPrice(): Promise<string | null> {
  try {
    const url = `${MAGIC_EDEN_API}/apechain/collections/v7`;
    
    const headers: any = {
      'accept': '*/*'
    };
    
    if (MAGIC_EDEN_KEY) {
      headers['Authorization'] = `Bearer ${MAGIC_EDEN_KEY}`;
    }

    const response = await axios.get(url, {
      params: {
        id: cfg.npc
      },
      headers
    });

    const collection = response.data?.collections?.[0];
    const floorPrice = collection?.floorAsk?.price?.amount?.decimal;

    return floorPrice ? floorPrice.toString() : null;

  } catch (error: any) {
    console.error('[MagicEden] Error getting floor price:', error.message);
    return null;
  }
}
