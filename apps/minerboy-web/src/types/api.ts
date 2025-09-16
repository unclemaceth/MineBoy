import type { Hex } from "./mining";

export type Address = `0x${string}`;

export type ClaimStatus = "accepted" | "rejected" | "pending" | "error";

// Wire format from the backend
export type ApiJob = {
  jobId: string;
  data: `0x${string}`;

  // difficulty (backend may send either)
  suffix?: string;            // preferred
  target?: string;            // legacy/back-compat

  // counters / timing (wire can be loose)
  nonce?: number | string;    // some code made this a string — allow it
  nonceStart?: number;        // optional start offset from backend
  height?: number | string;
  ttlMs?: number;
  expiresAt?: number;
  difficultyBits?: number;
  rule?: "suffix" | "bits";
  targetBits?: number;
};

export type ClaimReq = {
  minerId: `0x${string}`;
  sessionId: string;
  jobId: string;
  preimage: string;
  hash: `0x${string}`;
  steps: number;
  hr: number;
};

export interface ClaimRes {
  claimId: string;
  status: ClaimStatus;
  txHash?: string;
  nextJob?: any; // optional – sometimes server won't issue a next job
  // NOTE: there is **no** `ok` or `signature` here by design
}

export function normalizeClaimRes(raw: any): ClaimRes {
  return {
    claimId: String(raw.claimId ?? raw.claim_id ?? ''),
    status: (raw.status ?? 'pending') as ClaimStatus,
    txHash: raw.txHash ?? raw.tx_hash,
    nextJob: raw.nextJob ?? raw.next_job,
  };
}