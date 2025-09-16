// packages/shared/src/mining.ts

// ---------- Types ----------
export type MiningRule = 'suffix';

export interface EpochDifficulty {
  rule: 'suffix';
  suffix: string;     // required suffix (e.g., "00", "000", "0000")
  ttlMs: number;      // job TTL
}

export interface Job {
  jobId: string;
  algo: 'sha256-suffix';
  charset: 'hex';
  nonce: string;        // 0x...
  expiresAt: number;    // epoch ms
  // difficulty
  rule: 'suffix';
  suffix: string;       // required suffix (e.g., "00", "000", "0000")
  epoch: number;
  ttlMs: number;
}

// Optional (used by frontend/backend)
export interface CartridgeConfig {
  chainId: number;
  name: string;
  contract: string;
  image?: string;
}

// API request/response types
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

export interface ClaimStruct {
  wallet: string;
  cartridge: string;
  tokenId: string;
  rewardToken: string;
  rewardAmount: string;
  workHash: string;
  attempts: string;
  nonce: string;
  expiry: string;
}

// ---------- Difficulty System ----------
export type Difficulty = {
  zeros: number;        // how many trailing zeros required
  suffix: string;       // the literal "000000..." string
  ttlMs: number;        // job TTL in milliseconds
};

/**
 * Our epoch → difficulty policy:
 *   epoch 0 → 6 zeros (000000)
 *   epoch 1 → 7 zeros (0000000) 
 *   epoch 2+ → 8 zeros (00000000) - cap
 */
export function getDifficultyForEpoch(epoch: number | bigint): Difficulty {
  const e = Number(epoch ?? 0);
  const zeros = Math.min(6 + Math.max(e, 0), 8);
  const ttlMs = e === 0 ? 30 * 60_000 : e === 1 ? 4 * 60 * 60_000 : 24 * 60 * 60_000;
  return { 
    zeros, 
    suffix: '0'.repeat(zeros),
    ttlMs
  };
}

export function hashMeetsDifficulty(hash: `0x${string}`, suffix: string): boolean {
  return hash.toLowerCase().endsWith(suffix);
}

// simple back-compat helper if some code still wants suffix
export function getSuffixForEpoch(epoch: number): string {
  const d = getDifficultyForEpoch(epoch);
  return d.suffix;
}

// Default export for ESM/CJS interop safety
const Mining = { getDifficultyForEpoch, hashMeetsDifficulty, getSuffixForEpoch };
export default Mining;