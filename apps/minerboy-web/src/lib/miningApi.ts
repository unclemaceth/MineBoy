export type LockErrorCode =
  | 'cartridge_in_use'            // someone else holds the 1h ownership lock
  | 'active_session_elsewhere'    // session lock owned by different session/wallet
  | 'session_still_active'        // recent heartbeats (<grace) from same session
  | 'session_expired'             // session lock missing/expired
  | 'lock_expired'                // 1h ownership lock expired
  | 'wallet_session_limit_exceeded'
  | 'bad_request' | 'unauthorized' | 'internal';

export interface StartReq {
  wallet: `0x${string}`;
  chainId: number;
  contract: `0x${string}`;
  tokenId: number;
  sessionId: string;
  minerId?: string;
}

export interface StartOk {
  tokenId: number;
  sessionId: string;
  ownerWallet: `0x${string}`;
  ownershipTtlSec: number;   // ~3600
  sessionTtlSec: number;     // ~60
  // optionally server can echo now/exp for countdown UX
  ownershipExp?: number;     // unix seconds
}

export interface ErrRes { 
  code: LockErrorCode; 
  message?: string; 
  ttlRemainingSec?: number;
  remainingMinutes?: number;
  limit?: number;
  activeCount?: number;
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw body as ErrRes;
  return body as T;
}

export async function apiStart(req: StartReq): Promise<StartOk> {
  const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "https://mineboy-g5xo.onrender.com";
  const res = await fetch(`${BASE}/v2/session/open`, { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify(req) 
  });
  return json<StartOk>(res);
}

export async function apiHeartbeat(req: StartReq): Promise<{ sessionTtlSec: number }> {
  const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "https://mineboy-g5xo.onrender.com";
  const { wallet, ...heartbeatReq } = req; // Remove wallet from heartbeat request
  const res = await fetch(`${BASE}/v2/session/heartbeat`, { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify(heartbeatReq) 
  });
  return json(res);
}

export async function apiStop(req: StartReq): Promise<{ ok: true }> {
  const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "https://mineboy-g5xo.onrender.com";
  const { wallet, ...stopReq } = req; // Remove wallet from stop request
  const res = await fetch(`${BASE}/v2/session/stop`, { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify(stopReq) 
  });
  return json(res);
}
