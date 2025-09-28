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
    return jfetch("/v2/cartridges", undefined, (j) => j.cartridges as CartridgeConfig[]);
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
  
  async heartbeat(sessionId: string, minerId: string, tokenId: string, chainId: number, contract: string): Promise<{ ok: true }> {
    const { headers } = await jfetchEx(`/v2/session/heartbeat`, { 
      method: "POST", 
      credentials: 'include',
      body: JSON.stringify({ sessionId, minerId, tokenId, chainId, contract }) 
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

  async claimV2(body: ClaimReq): Promise<ClaimRes & { tier: number; tierName: string; amountLabel: string }> {
    try {
      const { json, headers } = await jfetchEx("/v2/claim/v2", { 
        method: "POST", 
        body: JSON.stringify(body) 
      });
      
      console.log('[CLAIM_V2_OK]', { 
        xInstance: headers['x-instance'], 
        lockOwner: headers['x-lock-owner'],
        tier: json.tier,
        tierName: json.tierName,
        amountLabel: json.amountLabel
      });
      
      const res = normalizeClaimRes(json);
      if (res.nextJob) {
        res.nextJob = normalizeJob(res.nextJob as ApiJob);
      }
      return {
        ...res,
        tier: json.tier,
        tierName: json.tierName,
        amountLabel: json.amountLabel
      };
    } catch (e: any) {
      console.log('[CLAIM_V2_ERR]', e.status, { 
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

// Teams API helpers
export type Team = { slug: string; name: string; emoji?: string; color?: string; };

export async function apiListTeams(): Promise<Team[]> {
  const r = await fetch(`${BASE}/v2/teams`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed to fetch teams');
  return r.json();
}

export async function apiGetUserTeam(wallet: `0x${string}`): Promise<{ team: Team | null }> {
  const r = await fetch(`${BASE}/v2/user/team?wallet=${wallet}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed to fetch user team');
  return r.json();
}

export async function apiPickTeam(wallet: `0x${string}`, teamSlug: string) {
  const r = await fetch(`${BASE}/v2/user/team`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ wallet, teamSlug })
  });
  if (!r.ok) throw new Error('team pick failed');
  return r.json() as Promise<{ ok: true; team: Team }>;
}

export async function apiLeaderboardTeams() {
  const r = await fetch(`${BASE}/v2/leaderboard/team?season=active`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed to fetch team standings');
  return r.json() as Promise<Array<Team & { members: number; total_score: string }>>;
}

export async function apiGetArcadeName(wallet: string) {
  const r = await fetch(`${BASE}/v2/user/name?wallet=${wallet}`);
  if (!r.ok) throw new Error('failed');
  return r.json() as Promise<{ wallet: string; name: string | null }>;
}

export async function apiGetNameNonce(wallet: string) {
  const r = await fetch(`${BASE}/v2/user/name/nonce?wallet=${wallet}`);
  if (!r.ok) throw new Error('failed');
  return r.json() as Promise<{ nonce: string }>;
}

export async function apiSetArcadeName(wallet: string, name: string, nonce: string, expiry: string, sig: string) {
  const r = await fetch(`${BASE}/v2/user/name`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet, name, nonce, expiry, sig }),
  });
  if (r.status === 409) {
    const { error } = await r.json();
    throw new Error(error); // 'taken' | 'locked'
  }
  if (!r.ok) throw new Error('server');
  return r.json() as Promise<{ ok: true; name: string }>;
}

// Season-based API functions
export type Season = {
  id: number;
  slug: string;
  scope: 'TEAM' | 'INDIVIDUAL';
  starts_at: string;
  ends_at?: string;
  is_active: boolean;
  created_at: string;
};

export type SeasonLeaderboardEntry = {
  rank: number;
  wallet: string;
  walletShort: string;
  totalABIT: string;
  arcade_name?: string;
};

export type SeasonLeaderboardResponse = {
  season: Season;
  entries: SeasonLeaderboardEntry[];
  me?: {
    rank: number;
    wallet: string;
    walletShort: string;
    totalABIT: string;
    arcade_name?: string;
  };
  lastUpdated: string;
  nextUpdate: string;
};

export type TeamLeaderboardEntry = {
  rank: number;
  team_slug: string;
  name: string;
  emoji?: string;
  color?: string;
  members: number;
  totalABIT: string;
};

export type TeamLeaderboardResponse = {
  season: Season;
  entries: TeamLeaderboardEntry[];
  lastUpdated: string;
  nextUpdate: string;
};

export type TeamChoiceResponse = {
  chosen: boolean;
  team_slug?: string;
  season_slug?: string;
  season_id?: number;
  season?: Season;
};

export async function apiGetSeasons(scope?: 'TEAM' | 'INDIVIDUAL'): Promise<{ seasons: Season[] }> {
  const params = scope ? `?scope=${scope}` : '';
  const r = await fetch(`${BASE}/v2/seasons${params}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed to fetch seasons');
  return r.json();
}

export async function apiGetUserTeamChoice(wallet: `0x${string}`, season?: string): Promise<TeamChoiceResponse> {
  const seasonParam = season ? `&season=${season}` : '&season=active';
  const r = await fetch(`${BASE}/v2/user/team?wallet=${wallet}${seasonParam}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed to fetch user team choice');
  return r.json();
}

export async function apiChooseTeam(wallet: `0x${string}`, teamSlug: string, nonce: string, expiry: string, sig: string): Promise<{
  ok: boolean;
  season_id: number;
  season_slug: string;
  team_slug: string;
  attributed_claims: number;
}> {
  const r = await fetch(`${BASE}/v2/teams/choose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet, team_slug: teamSlug, nonce, expiry, sig }),
  });
  if (r.status === 409) {
    const { error } = await r.json();
    throw new Error(error); // 'already_chosen'
  }
  if (r.status === 400) {
    const { error } = await r.json();
    throw new Error(error); // 'no_active_team_season', 'invalid_nonce', 'expired', 'bad_sig'
  }
  if (!r.ok) throw new Error('Failed to choose team');
  return r.json();
}

export async function apiGetIndividualLeaderboard(season: string = 'active', limit?: number, offset?: number, wallet?: string): Promise<SeasonLeaderboardResponse> {
  const params = new URLSearchParams();
  params.set('season', season);
  if (limit) params.set('limit', String(limit));
  if (offset) params.set('offset', String(offset));
  if (wallet) params.set('wallet', wallet);
  
  const r = await fetch(`${BASE}/v2/leaderboard/individual?${params.toString()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed to fetch individual leaderboard');
  return r.json();
}

export async function apiGetTeamLeaderboard(season: string = 'active'): Promise<TeamLeaderboardResponse> {
  const r = await fetch(`${BASE}/v2/leaderboard/team?season=${season}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Failed to fetch team leaderboard');
  return r.json();
}