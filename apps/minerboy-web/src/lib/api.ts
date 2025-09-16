import { normalizeJob, normalizeClaimRes } from "@/types/api";
import type { CartridgeConfig, ClaimRes, Job, Address } from "@/types/api";

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

async function jfetch<T>(path: string, init?: RequestInit, map?: (x: any) => T): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { "content-type": "application/json", ...(init?.headers || {}) }});
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
  const json = await res.json();
  return map ? map(json) : (json as T);
}

export const api = {
  cartridges(): Promise<CartridgeConfig[]> {
    return jfetch("/v2/cartridges", undefined, (j) => j as CartridgeConfig[]);
  },
  
  openSession(body: OpenSessionReq): Promise<OpenSessionRes> {
    return jfetch("/v2/session/open", { method: "POST", body: JSON.stringify(body) }, (j) => ({ 
      sessionId: String(j.sessionId ?? j.session_id),
      job: normalizeJob(j.job) || { id: "", data: "", target: "" },
      policy: j.policy || { heartbeatSec: 20, cooldownSec: 2 },
      claim: j.claim
    }));
  },
  
  heartbeat(sessionId: string, minerId: string): Promise<{ ok: true }> {
    return jfetch(`/v2/session/heartbeat`, { 
      method: "POST", 
      body: JSON.stringify({ sessionId, minerId }) 
    }, () => ({ ok: true }));
  },
  
  claim(body: ClaimReq): Promise<ClaimRes> {
    return jfetch("/v2/claim", { 
      method: "POST", 
      body: JSON.stringify(body) 
    }, normalizeClaimRes);
  },
  
  close(sessionId: string): Promise<{ ok: true }> {
    return jfetch(`/v2/session/close`, { 
      method: "POST", 
      body: JSON.stringify({ sessionId }) 
    }, () => ({ ok: true }));
  },
  
  getNextJob(sessionId: string): Promise<Job> {
    return jfetch(`/v2/job/next?sessionId=${encodeURIComponent(sessionId)}`, undefined, (j) => {
      const job = normalizeJob(j);
      if (!job) throw new Error("bad job payload");
      return job;
    });
  },
  
  getStats(): Promise<unknown> {
    return jfetch("/admin/stats", undefined, (j) => j);
  },

  claimTx(body: { claimId: string; txHash: string }): Promise<{ ok: true }> {
    return jfetch("/v2/claim/tx", { 
      method: "POST", 
      body: JSON.stringify(body) 
    }, () => ({ ok: true }));
  },

  getLeaderboard(params: { period?: 'all'|'24h'|'7d'; limit?: number; wallet?: Address } = {}): Promise<unknown> {
    const usp = new URLSearchParams();
    if (params.period) usp.set('period', params.period);
    if (params.limit) usp.set('limit', String(params.limit));
    if (params.wallet) usp.set('wallet', params.wallet);
    return jfetch(`/v2/leaderboard?${usp.toString()}`, undefined, (j) => j);
  }
};