import type { Job } from '@/types/mining';
import { API_BASE } from './wagmi';

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

export interface ClaimRes {
  success: boolean;
  nextJob?: Job;
  reward?: string;
}

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API Error ${res.status}: ${errorText}`);
  }
  return res.json();
}

export const api = {
  cartridges(): Promise<CartridgeConfig[]> {
    return fetch(`${API_BASE}/v2/cartridges`, { cache: 'no-store' }).then(j);
  },
  
  openSession(body: OpenSessionReq): Promise<OpenSessionRes> {
    return fetch(`${API_BASE}/v2/session/open`, {
      method: 'POST', 
      headers: { 'content-type': 'application/json' }, 
      body: JSON.stringify(body)
    }).then(j);
  },
  
  heartbeat(sessionId: string, minerId: string): Promise<{ ok: true }> {
    return fetch(`${API_BASE}/v2/session/heartbeat`, {
      method: 'POST', 
      headers: { 'content-type': 'application/json' }, 
      body: JSON.stringify({ sessionId, minerId })
    }).then(j);
  },
  
  claim(body: ClaimReq): Promise<ClaimRes> {
    return fetch(`${API_BASE}/v2/claim`, {
      method: 'POST', 
      headers: { 'content-type': 'application/json' }, 
      body: JSON.stringify(body)
    }).then(j);
  },
  
  close(sessionId: string): Promise<{ ok: true }> {
    return fetch(`${API_BASE}/v2/session/close`, {
      method: 'POST', 
      headers: { 'content-type': 'application/json' }, 
      body: JSON.stringify({ sessionId })
    }).then(j);
  },
  
  getNextJob(sessionId: string): Promise<Job> {
    return fetch(`${API_BASE}/v2/job/next?sessionId=${sessionId}`, {
      cache: 'no-store'
    }).then(j<Job>);
  },
  
  getStats(): Promise<unknown> {
    return fetch(`${API_BASE}/admin/stats`, { cache: 'no-store' }).then(j);
  },

  claimTx(body: { claimId: string; txHash: string }): Promise<{ ok: true }> {
    return fetch(`${API_BASE}/v2/claim/tx`, {
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
    return fetch(`${API_BASE}/v2/leaderboard?${usp.toString()}`, { method: 'GET' }).then(j);
  }
};
