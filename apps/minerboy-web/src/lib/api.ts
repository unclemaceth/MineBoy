import { normalizeClaimResponse, normalizeJob } from "@/types/api";
import type { ClaimRes } from "@/types/api";
import type { Job } from "@/types/mining";

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "https://mineboy-g5xo.onrender.com";

// Local type definitions (replacing shared imports)
export interface CartridgeConfig {
  chainId: number;
  name: string;
  contract: string;
  image?: string;
}

export interface OpenSessionReq {
  wallet: string;
  cartridge: { chainId: number; contract: string; tokenId: string };
  clientInfo?: any;
  minerId: string;
}

export interface OpenSessionRes {
  sessionId: string;
  job: Job;
  policy: { heartbeatSec: number; cooldownSec: number };
  claim: any;
}

export interface ClaimReq {
  sessionId: string;
  jobId: string;
  preimage: string;
  hash: string;
  steps: number;
  hr: number;
  minerId: string;
}

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`);
  }
  return (await res.json()) as T;
}

export async function getNextJob(sessionId: string): Promise<Job> {
  const res = await fetch(`${BASE}/v2/job/next?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
  const raw = await j<unknown>(res);
  const job = normalizeJob(raw);
  if (!job) throw new Error("Malformed job payload");
  return job;
}

export async function submitClaim(body: ClaimReq): Promise<ClaimRes> {
  const res = await fetch(`${BASE}/v2/claim`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const raw = await j<unknown>(res);
  return normalizeClaimResponse(raw);
}

export const api = {
  cartridges(): Promise<CartridgeConfig[]> {
    return fetch(`${BASE}/v2/cartridges`, { cache: 'no-store' }).then(j);
  },
  
  openSession(body: OpenSessionReq): Promise<OpenSessionRes> {
    return fetch(`${BASE}/v2/session/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }).then(j);
  },
  
  heartbeat(sessionId: string, minerId: string): Promise<{ ok: true }> {
    return fetch(`${BASE}/v2/session/heartbeat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' }, 
      body: JSON.stringify({ sessionId, minerId })
    }).then(j);
  },
  
  claim(body: ClaimReq): Promise<ClaimRes> {
    return submitClaim(body);
  },
  
  close(sessionId: string): Promise<{ ok: true }> {
    return fetch(`${BASE}/v2/session/close`, {
      method: 'POST', 
      headers: { 'content-type': 'application/json' }, 
      body: JSON.stringify({ sessionId })
    }).then(j);
  },
  
  getNextJob(sessionId: string): Promise<Job> {
    return getNextJob(sessionId);
  },
  
  getStats(): Promise<unknown> {
    return fetch(`${BASE}/admin/stats`, { cache: 'no-store' }).then(j);
  },

  claimTx(body: { claimId: string; txHash: string }): Promise<{ ok: true }> {
    return fetch(`${BASE}/v2/claim/tx`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(j);
  },

  getLeaderboard(params: { period?: 'all'|'24h'|'7d'; limit?: number; wallet?: string } = {}): Promise<unknown> {
    const usp = new URLSearchParams();
    if (params.period) usp.set('period', params.period);
    if (params.limit) usp.set('limit', String(params.limit));
    if (params.wallet) usp.set('wallet', params.wallet);
    return fetch(`${BASE}/v2/leaderboard?${usp.toString()}`, { method: 'GET' }).then(j);
  }
};