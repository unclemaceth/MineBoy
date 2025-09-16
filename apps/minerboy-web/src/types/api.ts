import type { Job, Hex } from "./mining";

/** The normalized shape the UI will use everywhere. */
export interface ClaimRes {
  claimId?: string;
  status?: "accepted" | "queued" | "pending" | "confirmed" | "failed";
  txHash?: Hex;
  nextJob?: Job;
}

/** Accept any backend shape and normalize it to ClaimRes. */
export function normalizeClaimResponse(raw: unknown): ClaimRes {
  const r: any = raw ?? {};
  const claimId = r.claimId ?? r.claim_id ?? r.id ?? r.claim?.id;
  const txHash = r.txHash ?? r.tx_hash ?? r.tx;
  const status = r.status;

  const nextJobRaw = r.nextJob ?? r.next_job;
  const nextJob = normalizeJob(nextJobRaw);

  return { claimId, status, txHash, nextJob };
}

/** Accept any backend job shape and normalize it to Job. */
export function normalizeJob(raw: unknown): Job | undefined {
  const j: any = raw;
  if (!j || typeof j !== "object") return undefined;

  // Handle both new normalized format and backend legacy format
  const id = j.id ?? j.jobId ?? j.job_id ?? randomId();
  const data = j.data ?? j.header ?? j.blockHeader ?? j.nonce;
  const target = j.target ?? j.threshold ?? j.suffix;

  if (!id) return undefined;

  return {
    id,
    data: data || "0x0",
    target: target || "0x0",
    nonceStart: j.nonceStart ?? j.nonce_start,
    nonceEnd: j.nonceEnd ?? j.nonce_end,
    height: j.height ?? j.blockHeight ?? j.h,
    difficulty: j.difficulty ?? j.diff,
    // Backend compatibility fields
    jobId: j.jobId ?? j.job_id,
    algo: j.algo,
    charset: j.charset,
    nonce: j.nonce,
    expiresAt: j.expiresAt ?? j.expires_at,
    rule: j.rule,
    suffix: j.suffix,
    epoch: j.epoch,
    ttlMs: j.ttlMs ?? j.ttl_ms
  };
}

function randomId() {
  return Math.random().toString(36).slice(2);
}
