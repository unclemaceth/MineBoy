import type { ApiJob } from "@/types/api";
import type { Job as MiningJob } from "@/types/mining";

export function normalizeJob(j: ApiJob): MiningJob {
  const nonceNum =
    typeof j.nonce === "string" ? parseInt(j.nonce, 16) :
    typeof j.nonce === "number" ? j.nonce : 0;

  const target = (j.suffix ?? j.target ?? "000000").toString();
  const height = typeof j.height === "string" ? Number(j.height) : (j.height ?? 0);
  const ttlMs = Number(j.ttlMs ?? 30_000);
  const expiresAt = Number(j.expiresAt ?? (Date.now() + ttlMs));

  return {
    id: j.jobId,
    jobId: j.jobId,
    data: j.data as `0x${string}`,
    nonce: Number.isFinite(nonceNum) ? nonceNum : 0,
    target,
    height,
    ttlMs,
    expiresAt,
  };
}
