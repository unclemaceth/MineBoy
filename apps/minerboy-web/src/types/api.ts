import type { Job, Hex } from "./mining";

export type Address = `0x${string}`;

export type ClaimStatus = "accepted" | "rejected" | "pending" | "error";

export interface ClaimRes {
  claimId: string;
  status: ClaimStatus;
  txHash?: string;
  nextJob?: Job; // optional – sometimes server won't issue a next job
  // NOTE: there is **no** `ok` or `signature` here by design
}

const toNum = (v: unknown) =>
  typeof v === "number" ? v :
  typeof v === "string" && v.trim() ? Number(v) : undefined;

const idFrom = (x: any) => String(x?.id ?? x?.jobId ?? x?.job_id ?? crypto.randomUUID?.() ?? Math.random());

export function normalizeJob(raw: unknown): Job | undefined {
  const j: any = raw;
  if (!j || typeof j !== "object") return;

  const data = j.data ?? j.header ?? j.blockHeader;
  const target = j.target ?? j.threshold;
  if (!data || !target) return;

  const id = idFrom(j);
  const height = toNum(j.height ?? j.blockHeight ?? j.h);
  const difficulty = toNum(j.difficulty ?? j.diff ?? j.difficultyBits ?? j.bits);
  const nonceStart = toNum(j.nonceStart ?? j.nonce_start);
  const nonceEnd = toNum(j.nonceEnd ?? j.nonce_end);
  const nonce = toNum(j.nonce);
  const expiresAt = toNum(j.expiresAt ?? j.expires_at);
  const suffix = typeof j.suffix === "string" ? j.suffix : undefined;
  const rule = j.rule === "suffix" || j.rule === "bits" ? j.rule : undefined;
  const difficultyBits = toNum(j.difficultyBits ?? j.bits);
  const targetBits = toNum(j.targetBits);

  return {
    id,
    jobId: id, // compat
    data,
    target,
    height,
    difficulty,
    nonceStart,
    nonceEnd,
    nonce,
    expiresAt,
    suffix,
    rule,
    difficultyBits,
    targetBits,
    bits: difficultyBits // compat alias
  };
}

export function normalizeClaimRes(raw: unknown): ClaimRes {
  const r: any = raw ?? {};
  const nextJob = normalizeJob(r.nextJob ?? r.next_job);
  return {
    claimId: String(r.claimId ?? r.claim_id ?? ""),
    status: (r.status as ClaimStatus) ?? "pending",
    txHash: r.txHash ?? r.tx_hash,
    ...(nextJob ? { nextJob } : {})
  };
}
