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
  sessionId: string;
  job?: {
    id: string;
    data: string;  // Backend sends as string, will be normalized to 0x${string}
    nonce: string;
    target: string;
    suffix: string;
    height: number;
    difficulty: number;
    expiresAt?: number;
    ttlMs?: number;
    epoch?: number;
    rule: string;
    difficultyBits: number;
    targetBits?: number;
  };
  policy?: {
    heartbeatSec: number;
    cooldownSec: number;
  };
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

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "https://mineboy-g5xo.onrender.com";

const fetchJSON = async (path: string, body: any) => {
  const res = await fetch(`${API_BASE}/v2${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',          // IMPORTANT for cookie auth
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`[${path} ${res.status}] ${text}`);
  return text ? JSON.parse(text) : {};
};

export async function apiStart(req: StartReq): Promise<StartOk> {
  return fetchJSON('/v2/session/open', req) as Promise<StartOk>;
}

export async function apiHeartbeat(req: StartReq): Promise<{ sessionTtlSec: number }> {
  // Include wallet for ownership lock validation
  const payload = {
    sessionId: req.sessionId,
    minerId: req.minerId,
    wallet: req.wallet,
    chainId: req.chainId,
    contract: req.contract,
    tokenId: req.tokenId.toString(), // Ensure it's a string for canonical consistency
  };
  return fetchJSON('/session/heartbeat', payload) as Promise<{ sessionTtlSec: number }>;
}

export async function apiStop(req: StartReq): Promise<{ ok: true }> {
  // Include wallet for session validation
  const payload = {
    sessionId: req.sessionId,
    minerId: req.minerId,
    wallet: req.wallet,
    chainId: req.chainId,
    contract: req.contract,
    tokenId: Number(req.tokenId), // Ensure it's a number
  };
  return fetchJSON('/session/stop', payload) as Promise<{ ok: true }>;
}
