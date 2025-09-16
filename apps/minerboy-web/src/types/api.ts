import type { Hex } from "./mining";

export type Address = `0x${string}`;

export type ClaimStatus = "accepted" | "rejected" | "pending" | "error";

// Wire format from backend
export type ApiJob = {
  jobId: string;
  data: `0x${string}`;

  // optional/legacy fields from backend responses
  nonce?: number | `0x${string}`;
  suffix?: string;         // preferred (e.g. "000000")
  target?: string;         // legacy alias for suffix
  height?: number | string;
  ttlMs?: number | string;
  expiresAt?: number | string;

  // if backend ever sends these, accept them
  rule?: string;           // e.g. "suffix"
  targetBits?: number | string;
  difficultyBits?: number | string;
  bits?: number | string;
};

export type ApiOpenSessionResp = {
  sessionId: string;
  job: ApiJob;
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