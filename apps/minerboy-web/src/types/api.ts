import type { Hex } from "./mining";

export type Address = `0x${string}`;

export type ClaimStatus = "accepted" | "rejected" | "pending" | "error";

// Shape coming *from* the backend
export type ApiJob = {
  jobId: string;                    // <-- source of truth for id
  data: `0x${string}`;              // seed / preimage base
  target?: string;                  // "000000" suffix (preferred)
  suffix?: string;                  // older field name; fallback
  height?: number;

  // difficulty metadata (optional)
  difficulty?: {
    rule: 'suffix';
    bits: number;                   // e.g. 24 for "000000"
    targetBits?: number;
  };

  // DO NOT treat nonce as a number; if it exists it must be a string.
  nonce?: `0x${string}` | string;
};

export type SessionOpenApiResp = {
  sessionId: string;
  job?: ApiJob;                     // job may be absent
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