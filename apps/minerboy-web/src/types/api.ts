export type Address = `0x${string}`;

export type ClaimStatus = "accepted" | "rejected" | "pending" | "error";

// Shape coming FROM the backend
export type ApiJob = {
  jobId?: string;               // backend may send jobId
  id?: string;                  // or id (fallback)
  data: `0x${string}`;
  target?: string;              // preferred
  suffix?: string;              // legacy
  height?: number;

  difficulty?: {
    rule: 'suffix';
    bits: number;
    targetBits?: number;
  };

  nonce?: `0x${string}` | string;

  // expiry / ttl variants (any may be present)
  expiresAt?: number;           // epoch ms
  ttlMs?: number;
  ttlSec?: number;
};

export type SessionOpenApiResp = {
  sessionId: string;
  job?: ApiJob;
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