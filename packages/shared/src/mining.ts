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
  suffix: string;       // DEPRECATED: use allowedSuffixes
  epoch: number;
  ttlMs: number;
  
  // ANTI-BOT FIELDS (REQUIRED for all new jobs)
  issuedAtMs: number;         // when server issued this job (epoch ms)
  counterStart: number;       // inclusive - start of counter window
  counterEnd: number;         // exclusive - end of counter window
  maxHps: number;             // server hashrate cap (e.g., 5000)
  allowedSuffixes: string[];  // difficulty sets (e.g., ["00000", "33333", "55555"])
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

// ---------- ANTI-BOT HELPERS (STRICT MODE) ----------

/**
 * Calculate minimum time required for a given number of hash attempts
 * Uses strict physics: tries / maxHps * 1000ms
 * @param tries Number of hash attempts
 * @param maxHps Maximum hashrate (e.g., 5000)
 * @param slack Tolerance factor (0.70 = allow 70% of theoretical time minimum)
 * @returns Minimum milliseconds required (no slack if omitted)
 */
export function minMsForTries(tries: number, maxHps: number, slack = 1.0): number {
  if (tries <= 0 || maxHps <= 0) return 0;
  const ms = (tries / maxHps) * 1000;
  return Math.floor(ms * slack);
}

/**
 * Check if hash ends with a specific suffix (no 0x handling, expects raw hex)
 * @param hash The hash to check (with or without 0x prefix)
 * @param suffix The required suffix (e.g., "00000")
 */
export function hashHasSuffix(hash: string, suffix: string): boolean {
  const h = (hash.startsWith('0x') ? hash.slice(2) : hash).toLowerCase();
  const s = suffix.toLowerCase().replace(/^0x/, '');
  return h.endsWith(s);
}

/**
 * Check if hash matches ANY suffix in an allowed set
 * @param hash The hash to check
 * @param allowed Array of allowed suffixes (e.g., ["00000", "33333", "55555"])
 * @returns true if hash ends with any of the allowed suffixes
 */
export function hashInAllowedSuffixes(hash: string, allowed: string[]): boolean {
  if (!Array.isArray(allowed) || allowed.length === 0) return false;
  for (const suffix of allowed) {
    if (hashHasSuffix(hash, suffix)) return true;
  }
  return false;
}

/**
 * STRICT difficulty checker - REQUIRES allowedSuffixes, no fallback
 * @param hash The hash to check
 * @param job Job object with REQUIRED allowedSuffixes field
 * @throws Error if job.allowedSuffixes is missing or empty
 */
export function hashMeetsRule(hash: string, job: { allowedSuffixes: string[] }): boolean {
  if (!job.allowedSuffixes || job.allowedSuffixes.length === 0) {
    throw new Error('Job missing allowedSuffixes - client must upgrade');
  }
  return hashInAllowedSuffixes(hash, job.allowedSuffixes);
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