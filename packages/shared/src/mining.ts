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

// ---------- Difficulty Table ----------
export const DIFFICULTY_TABLE: Record<number, EpochDifficulty> = {
  0: { rule: 'suffix', suffix: '000000', ttlMs: 30 * 60_000 },    // ~1 min desktop, ~10+ min phones
  1: { rule: 'suffix', suffix: '0000000', ttlMs: 4 * 60 * 60_000 }, // ~18 min desktop, ~1-3h phones  
  2: { rule: 'suffix', suffix: '00000000', ttlMs: 24 * 60 * 60_000 }, // ~4.8h desktop, ~1-2 days phones
  3: { rule: 'suffix', suffix: '00000000', ttlMs: 24 * 60 * 60_000 }, // Keep at 8 zeros for stability
};

// get base difficulty by epoch, then apply optional override
export function getDifficultyForEpoch(
  epoch: number,
  override?: Partial<EpochDifficulty>
): EpochDifficulty {
  const base = DIFFICULTY_TABLE[epoch] ?? DIFFICULTY_TABLE[0];
  return {
    rule: 'suffix',
    suffix: override?.suffix ?? base.suffix,
    ttlMs: override?.ttlMs ?? base.ttlMs,
  };
}

// simple back-compat helper if some code still wants suffix
export function getSuffixForEpoch(epoch: number): string {
  const d = getDifficultyForEpoch(epoch);
  return d.suffix;
}

// Default export for ESM/CJS interop safety
export default {
  DIFFICULTY_TABLE,
  getDifficultyForEpoch,
  getSuffixForEpoch,
};