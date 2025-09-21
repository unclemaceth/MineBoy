export type SessionId = string;

function uuid(): string {
  // crypto.randomUUID() when available, fallback if not
  try { 
    return crypto.randomUUID(); 
  } catch { 
    return Math.random().toString(36).slice(2) + Date.now(); 
  }
}

const key = (tokenId: number) => `mining:session:${tokenId}`;

export function getOrCreateSessionId(tokenId: number): SessionId {
  const store = typeof window !== 'undefined' ? window.sessionStorage : undefined;
  if (!store) return uuid();
  
  let id = store.getItem(key(tokenId));
  if (!id) {
    id = uuid();
    store.setItem(key(tokenId), id);
  }
  return id;
}

export function clearSessionId(tokenId: number) {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(key(tokenId));
  }
}
