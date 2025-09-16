// minerId.ts - Consistent miner ID management
const KEY = 'mb/minerId';

export function getMinerId(): string {
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

// Freeze the minerId for the entire page lifecycle
export const MINER_ID = getMinerId();
console.log('[MINER_ID]', MINER_ID);
