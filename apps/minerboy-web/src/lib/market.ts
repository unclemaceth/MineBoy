/**
 * MineBoy Marketplace API Client
 * Handles buying/selling NPCs directly on MineBoy site
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://mineboy-g5xo.onrender.com';

export type MarketOrder = {
  tokenId: string;
  priceWei: string;
  orderId: string | null;
  maker: string;
  priceAPE: string;
};

export type MarketListing = {
  chainId: number;
  orders: MarketOrder[];
};

/**
 * Get all active market listings
 */
export async function getOrders(): Promise<MarketListing> {
  const response = await fetch(`${BACKEND_URL}/market/orders`, {
    cache: 'no-store'
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch orders: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get a specific listing by token ID
 */
export async function getOrder(tokenId: string): Promise<any> {
  const response = await fetch(`${BACKEND_URL}/market/orders/${tokenId}`, {
    cache: 'no-store'
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('not-listed');
    }
    throw new Error(`Failed to fetch order: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Build a fill transaction for buying an NPC
 * Returns: { chainId, to, data, value, seaport, priceAPE }
 */
export async function buildFill(tokenId: string): Promise<{
  chainId: number;
  to: string;
  data: string;
  value: string;
  seaport: string;
  priceAPE: string;
}> {
  const response = await fetch(`${BACKEND_URL}/market/build-fill`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ tokenId })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (response.status === 410) {
      throw new Error('sold');
    }
    if (response.status === 404) {
      throw new Error('not-listed');
    }
    throw new Error(error.error || 'cant-build');
  }
  
  return response.json();
}

/**
 * Confirm a purchase transaction
 */
export async function confirmFill(params: {
  tokenId: string;
  txHash: string;
  buyer: string;
}): Promise<{ ok: boolean }> {
  const response = await fetch(`${BACKEND_URL}/market/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params)
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'confirm-failed');
  }
  
  return response.json();
}
