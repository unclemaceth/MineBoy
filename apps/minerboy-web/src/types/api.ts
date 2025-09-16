import type { Hex } from "./mining";

export type Address = `0x${string}`;

export type ClaimStatus = "accepted" | "rejected" | "pending" | "error";

export type Job = {
  // canonical
  id: string;
  data: string;
  target: string;

  // optional/canonical
  height?: number;
  difficulty?: number;
  nonceStart?: number;
  nonceEnd?: number;
  expiresAt?: number;

  // legacy compat (existing call-sites expect these – keep optional)
  jobId?: string;
  nonce?: number;
  suffix?: string;
  rule?: "suffix" | "bits";
  difficultyBits?: number;
  targetBits?: number;
  bits?: number; // read-only compat
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
  nextJob?: Job; // optional – sometimes server won't issue a next job
  // NOTE: there is **no** `ok` or `signature` here by design
}

const toNum = (v: unknown) =>
  typeof v === "number" ? v :
  typeof v === "string" && v.trim() ? Number(v) : undefined;

const idFrom = (x: any) => String(x?.id ?? x?.jobId ?? x?.job_id ?? crypto.randomUUID?.() ?? Math.random());

export function normalizeJob(raw: unknown): Job | undefined {
  const j: any = raw;
  if (!j || typeof j !== "object") {
    console.error('[normalizeJob] missing or invalid job:', raw);
    return;
  }

  // Handle both frontend and backend job shapes
  const dataRaw = j.data ?? j.nonce ?? j.header ?? j.blockHeader;
  const target = j.target ?? j.suffix ?? j.threshold ?? (typeof j.zeros === 'number' ? '0'.repeat(j.zeros) : '');
  
  // Ensure data is properly formatted as hex
  const to0x = (v: any): `0x${string}` => {
    if (typeof v === 'number') return `0x${v.toString(16)}` as `0x${string}`;
    if (typeof v === 'bigint') return `0x${v.toString(16)}` as `0x${string}`;
    if (typeof v === 'string') return (v.startsWith('0x') ? v : `0x${v}`) as `0x${string}`;
    return '0x0' as `0x${string}`;
  };
  
  const data = to0x(dataRaw);
  
  if (!data || data === '0x0' || !target) {
    console.error('[normalizeJob] missing data or target:', { data, target, raw: j });
    return;
  }

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
