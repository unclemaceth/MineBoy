import { normalizeClaimRes } from "@/types/api";
import { normalizeJob } from "@/lib/normalizeJob";
import { jfetchEx } from "@/lib/api/jfetchEx";
import type { ClaimRes, ApiJob, Address, ClaimReq, SessionOpenApiResp } from "@/types/api";
import type { MiningJob } from "@/types/mining";

export interface CartridgeConfig {
  chainId: number;
  name: string;
  contract: string;
  image?: string;
}

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "https://mineboy-g5xo.onrender.com";

// Local type definitions (replacing shared imports)

export interface OpenSessionReq {
  wallet: string;
  cartridge: { chainId: number; contract: string; tokenId: string };
  clientInfo?: any;
  minerId: string;
}

export interface OpenSessionRes {
  sessionId: string;
  job?: MiningJob;
  policy: { heartbeatSec: number; cooldownSec: number };
  claim: any;
}

// ClaimReq is now imported from @/types/api

async function jfetch<T>(path: string, init?: RequestInit, map?: (x: any) => T): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { 
    ...init, 
    credentials: 'include', // Add this for cookie-sticky locks
    headers: { 
      "content-type": "application/json", 
      ...(init?.headers || {}) 
    } 
  });
  if (!res.ok) {
    let info: any = undefined;
    try { info = await res.json(); } catch {}
    const err: any = new Error(`HTTP ${res.status} ${path}`);
    err.status = res.status;
    err.info = info;
    throw err;
  }
  const json = await res.json();
  return map ? map(json) : (json as T);
}

export const api = {
  cartridges(): Promise<CartridgeConfig[]> {
    return jfetch("/v2/cartridges", undefined, (j) => j as CartridgeConfig[]);
  },
  
  openSession(body: OpenSessionReq): Promise<OpenSessionRes> {
    return jfetch("/v2/session/open", { method: "POST", body: JSON.stringify(body) }, (j) => {
      const apiResp = j as SessionOpenApiResp;
      const job = apiResp.job ? normalizeJob(apiResp.job) : undefined;
      return { 
        sessionId: apiResp.sessionId,
        job,
        policy: j.policy || { heartbeatSec: 20, cooldownSec: 2 },
        claim: j.claim
      };
    });
  },
  
  async heartbeat(sessionId: string, minerId: string): Promise<{ ok: true }> {
    const { headers } = await jfetchEx(`/v2/session/heartbeat`, { 
      method: "POST", 
      body: JSON.stringify({ sessionId, minerId }) 
    });
    
    // Log pod and lock info for debugging
    console.log('[HB]', { 
      minerId, 
      xInstance: headers['x-instance'], 
      lockOwner: headers['x-lock-owner'], 
      lockExp: Number(headers['x-lock-expires']) 
    });
    
    return { ok: true };
  },
  
  async claim(body: ClaimReq): Promise<ClaimRes> {
    try {
      const { json, headers } = await jfetchEx("/v2/claim", { 
        method: "POST", 
        body: JSON.stringify(body) 
      });
      
      console.log('[CLAIM_OK]', { 
        xInstance: headers['x-instance'], 
        lockOwner: headers['x-lock-owner'] 
      });
      
      const res = normalizeClaimRes(json);
      if (res.nextJob) {
        res.nextJob = normalizeJob(res.nextJob as ApiJob);
      }
      return res;
    } catch (e: any) {
      console.log('[CLAIM_ERR]', e.status, { 
        xInstance: e.headers?.['x-instance'], 
        lockOwner: e.headers?.['x-lock-owner'], 
        server: e.info 
      });
      throw e;
    }
  },
  
  close(sessionId: string): Promise<{ ok: true }> {
    return jfetch(`/v2/session/close`, { 
      method: "POST", 
      body: JSON.stringify({ sessionId }) 
    }, () => ({ ok: true }));
  },
  
  getNextJob(sessionId: string): Promise<MiningJob> {
    return jfetch(`/v2/job/next?sessionId=${encodeURIComponent(sessionId)}`, undefined, (j) => {
      return normalizeJob(j as ApiJob);
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
  },

  async debugLock(sessionId?: string, cartridge?: string): Promise<unknown> {
    const usp = new URLSearchParams();
    if (sessionId) usp.set('sessionId', sessionId);
    if (cartridge) usp.set('cartridge', cartridge);
    return jfetch(`/v2/debug/lock?${usp.toString()}`, undefined, (j) => j);
  }
};