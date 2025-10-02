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
  
  // NEW: Anti-bot & throttling fields
  issuedAtMs?: number;        // when server issued this job
  counterStart?: number;      // inclusive - start of counter window
  counterEnd?: number;        // exclusive - end of counter window
  maxHps?: number;            // server hashrate cap (e.g., 5000)
  allowedSuffixes?: string[]; // difficulty sets (e.g., ["00000", "33333", "55555"])
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
 *   epoch 0 → 5 zeros (00000)
 *   epoch 1 → 6 zeros (000000) 
 *   epoch 2+ → 7 zeros (0000000) - cap
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

// ---------- NEW: Anti-Bot Helpers ----------

/**
 * Calculate minimum time required for a given number of hash attempts
 * @param tries Number of hash attempts
 * @param maxHps Maximum hashrate (e.g., 5000)
 * @param slack Tolerance factor (0.70 = 70% of theoretical time, allows for variance)
 * @returns Minimum milliseconds required
 */
export function minMsForTries(tries: number, maxHps: number, slack = 0.70): number {
  const ms = Math.floor((tries / Math.max(1, maxHps)) * 1000);
  return Math.floor(ms * slack);
}

/**
 * Check if hash ends with a specific suffix
 * @param hash The hash to check (with or without 0x prefix)
 * @param suffix The required suffix (e.g., "00000")
 */
export function hashHasSuffix(hash: string, suffix: string): boolean {
  const h = (hash.startsWith('0x') ? hash.slice(2) : hash).toLowerCase();
  const s = suffix.toLowerCase().replace(/^0x/, '');
  return h.endsWith(s);
}

/**
 * Check if hash matches any suffix in an allowed set
 * @param hash The hash to check
 * @param allowed Array of allowed suffixes (e.g., ["00000", "33333", "55555"])
 */
export function hashInAllowedSuffixes(hash: string, allowed: string[]): boolean {
  if (!Array.isArray(allowed) || allowed.length === 0) return false;
  const h = (hash.startsWith('0x') ? hash.slice(2) : hash).toLowerCase();
  for (const s of allowed) {
    const sx = s.toLowerCase().replace(/^0x/, '');
    if (h.endsWith(sx)) return true;
  }
  return false;
}

/**
 * Unified difficulty checker - prefers allowedSuffixes when present, falls back to single suffix
 * @param hash The hash to check
 * @param job Job object with suffix and/or allowedSuffixes
 */
export function hashMeetsRule(hash: string, job: { suffix?: string; allowedSuffixes?: string[] }): boolean {
  // Prefer allowed sets when present
  if (job.allowedSuffixes?.length) {
    return hashInAllowedSuffixes(hash, job.allowedSuffixes);
  }
  // Fall back to single suffix for backward compatibility
  if (job.suffix) {
    return hashHasSuffix(hash, job.suffix);
  }
  return false;
}

// Default export for ESM/CJS interop safety
const Mining = { 
  getDifficultyForEpoch, 
  hashMeetsDifficulty, 
  getSuffixForEpoch,
  minMsForTries,
  hashHasSuffix,
  hashInAllowedSuffixes,
  hashMeetsRule
};
export default Mining;