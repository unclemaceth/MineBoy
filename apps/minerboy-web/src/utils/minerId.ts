// minerId.ts - Consistent miner ID management
const KEY = 'mb/minerId';

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

export function getMinerIdCached(): string {
  if (!_minerId) {
    _minerId = getMinerId();
    console.log('[MINER_ID]', _minerId);
  }
  return _minerId;
}
