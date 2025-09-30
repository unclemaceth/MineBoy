// minerId.ts - Consistent miner ID management
import { keccak256, toBytes } from 'viem';

const KEY = 'mb/minerId';

// Derive minerId from wallet address for consistency across devices/browsers
export function getMinerIdFromWallet(walletAddress: string): string {
  if (!walletAddress) {
    return 'mb_no_wallet';
  }
  
  // Hash the wallet address to create a deterministic minerId
  const hash = keccak256(toBytes(walletAddress.toLowerCase()));
  // Take first 32 chars of hash (without 0x prefix)
  const id = `mb_${hash.slice(2, 34)}`;
  return id;
}

export function getMinerId(): string {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    // Return a placeholder for SSR - will be replaced on client
    return 'mb_ssr_placeholder';
  }
  
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `mb_${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`;
    localStorage.setItem(KEY, id);
  }
  // hard-fix legacy bad values
  if (id.startsWith('0xmb_')) {
    id = id.slice(2);
    localStorage.setItem(KEY, id);
  }
  return id; // NOTE: NO to0x() here - this is NOT a hex address
}

// Lazy-loaded minerId to avoid SSR issues
let _minerId: string | null = null;
let _cachedWallet: string | null = null;

export function getMinerIdCached(walletAddress?: string): string {
  // If wallet address is provided, use wallet-based minerId
  if (walletAddress) {
    // If wallet changed, update cached minerId
    if (_cachedWallet !== walletAddress) {
      _minerId = getMinerIdFromWallet(walletAddress);
      _cachedWallet = walletAddress;
      console.log('[MINER_ID] Wallet-based:', _minerId);
    }
    return _minerId!;
  }
  
  // Fallback to localStorage-based minerId (for backward compatibility)
  if (!_minerId) {
    _minerId = getMinerId();
    console.log('[MINER_ID] localStorage-based:', _minerId);
  }
  return _minerId;
}
