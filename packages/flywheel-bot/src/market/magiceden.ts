import axios from 'axios';
import { cfg } from '../config.js';
import { flywheel } from '../wallets.js';
import type { ManualListing } from './manualListings.js';
import { getAddress, isAddress } from 'ethers';

/**
 * Magic Eden API Integration
 * 
 * Magic Eden WORKS on ApeChain!
 * Can fetch listings with actual transaction data.
 */

const MAGIC_EDEN_API = 'https://api-mainnet.magiceden.dev/v3/rtp';
const MAGIC_EDEN_KEY = process.env.MAGICEDEN_API_KEY;

// Security: Whitelist of trusted router/marketplace addresses
const ROUTER_WHITELIST = new Set([
  '0x0000000000000068f116a894984e2db1123eb395', // Seaport 1.6 (actual)
  '0x00000000000000adc04c56bf30ac9d3c0aaf14dc', // Seaport 1.5 (fallback)
  '0x2b59eb03865d18d8b62a5956bbbfae352fc1c148', // YakRouter (if used for purchases)
].map(a => a.toLowerCase()));

// Price sanity bounds (in APE)
const MIN_PRICE_APE = Number(process.env.MIN_NPC_PRICE || '10');
const MAX_PRICE_APE = Number(process.env.MAX_NPC_PRICE || '1000');

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
 * Validate listing data for security
 * Prevents malicious API responses from draining wallet
 */
function validateListing(listing: any): void {
  // Check required fields
  if (!listing || !listing.to || !listing.data) {
    throw new Error('Missing required fields (to, data)');
  }

  // Validate router/marketplace address
  const router = listing.to.toLowerCase();
  if (!isAddress(router)) {
    throw new Error(`Invalid router address: ${router}`);
  }
  
  if (!ROUTER_WHITELIST.has(router)) {
    throw new Error(`Router not whitelisted: ${router} (expected Seaport or YakRouter)`);
  }

  // Validate price is reasonable
  const priceAPE = Number(listing.priceNative || 0);
  if (!Number.isFinite(priceAPE) || priceAPE < MIN_PRICE_APE || priceAPE > MAX_PRICE_APE) {
    throw new Error(`Price ${priceAPE} APE outside sane range (${MIN_PRICE_APE}-${MAX_PRICE_APE})`);
  }

  // Validate tokenId is numeric
  const tokenId = String(listing.tokenId || '');
  if (!/^\d+$/.test(tokenId)) {
    throw new Error(`Invalid tokenId: ${tokenId}`);
  }

  // Validate calldata is hex
  const data = listing.data || '';
  if (!/^0x[0-9a-fA-F]+$/.test(data)) {
    throw new Error(`Invalid calldata format: ${data.substring(0, 20)}...`);
  }

  console.log(`[Security] ✅ Listing validated: tokenId=${tokenId}, price=${priceAPE} APE, router=${router.substring(0, 10)}...`);
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

    const listing = {
      to: txData.to,
      data: txData.data,
      valueWei: txData.value || priceWei,
      tokenId: tokenId,
      priceNative: priceNative
    };

    // Security: Validate listing before returning
    try {
      validateListing(listing);
    } catch (err: any) {
      console.error(`[Security] ❌ Listing validation failed: ${err.message}`);
      return null;
    }

    return listing;

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
      source: "magiceden.io",
      params: [
        {
          token: `${cfg.npc}:${tokenId}`,
          weiPrice: priceWei,
          orderKind: "seaport-v1.6",
          orderbook: "reservoir",
          automatedRoyalties: true,
          royaltyBps: 690, // 6.9% creator royalties (explicit)
          currency: "0x0000000000000000000000000000000000000000", // Native APE
          expirationTime: String(Math.floor(Date.now() / 1000) + (7 * 24 * 3600)), // 7 days
          options: {
            "seaport-v1.6": {
              useOffChainCancellation: false,
              replaceOrderId: undefined
            }
          }
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
          const { domain, types, value } = item.data.sign;
          
          // Validate before signing
          if (domain.chainId !== 33139) {
            console.error(`[MagicEden] Wrong chainId: ${domain.chainId}, expected 33139`);
            return false;
          }
          
          const maker = (value.maker || value.offerer || '').toLowerCase();
          const walletAddr = (await flywheel.getAddress()).toLowerCase();
          if (maker !== walletAddr) {
            console.error(`[MagicEden] Maker mismatch: ${maker} vs ${walletAddr}`);
            return false;
          }
          
          console.log(`[MagicEden] Signing listing order...`);
          // Sign typed data (DO NOT modify domain/types/value)
          const signature = await flywheel.signTypedData(domain, types, value);
          console.log(`[MagicEden] Generated signature: ${signature.substring(0, 20)}...`);
          
          // Store the full order in our backend for direct fulfillment
          try {
            const backendUrl = process.env.BACKEND_URL || 'https://mineboy-g5xo.onrender.com';
            await axios.post(`${backendUrl}/market/admin/store-order`, {
              tokenId,
              priceWei,
              signature,
              orderComponents: value,  // The full Seaport OrderComponents
              domain,
              expiresAt: value.endTime
            }, {
              headers: {
                'Authorization': `Bearer ${process.env.ADMIN_TOKEN || ''}`,
                'Content-Type': 'application/json'
              }
            });
            console.log(`[MagicEden] ✅ Stored order in MineBoy backend`);
          } catch (err: any) {
            console.warn(`[MagicEden] Failed to store order in backend: ${err.message}`);
            // Don't fail the listing if backend storage fails
          }
          
          // Post the signature back to Magic Eden
          const postUrl = item.data.post?.endpoint;
          const postMethod = item.data.post?.method || 'POST';
          
          if (postUrl) {
            // Build full URL - ensure it includes /apechain/ in the path
            let fullUrl;
            if (postUrl.startsWith('http')) {
              fullUrl = postUrl;
            } else if (postUrl.startsWith('/apechain/')) {
              fullUrl = `https://api-mainnet.magiceden.dev/v3/rtp${postUrl}`;
            } else {
              fullUrl = `https://api-mainnet.magiceden.dev/v3/rtp/apechain${postUrl}`;
            }
            
            // CRITICAL: Place signature in exact location API expects
            const postBodyTemplate = item.data.post?.body || {};
            const postBody = JSON.parse(JSON.stringify(postBodyTemplate));
            
            // Replace placeholder signature with our real one
            if (postBody.order?.data) {
              postBody.order.data.signature = signature;
              console.log(`[MagicEden] Placed signature in order.data.signature`);
            } else {
              // Fallback
              postBody.signature = signature;
              console.log(`[MagicEden] Placed signature at root level (fallback)`);
            }
            
            console.log(`[MagicEden] Submitting to ${fullUrl}...`);
            
            const postResponse = await axios({
              method: postMethod,
              url: fullUrl,
              data: postBody,
              headers
            });
            
            console.log(`[MagicEden] Post response status: ${postResponse.status}`);
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
