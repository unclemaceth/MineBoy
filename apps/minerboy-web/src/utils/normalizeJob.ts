import type { ApiJob } from "@/types/api";
import type { Job as MiningJob } from "@/types/mining";

const toInt = (v: unknown, base10Fallback = 0): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    // handle hex like "0x1a" or decimal "42"
    const n = v.startsWith("0x") ? parseInt(v, 16) : parseInt(v, 10);
    return Number.isFinite(n) ? n : base10Fallback;
  }
  return base10Fallback;
};

export function normalizeJob(api: ApiJob): MiningJob {
  const suffix = (api.suffix ?? api.target ?? "").toString();
  const zeros = /^[0]+$/.test(suffix) ? suffix.length : 0;

  const ttlMs = toInt(api.ttlMs, 0);
  const expiresAt = typeof api.expiresAt === "number"
    ? api.expiresAt
    : ttlMs > 0 ? Date.now() + ttlMs : Date.now();

  // prefer explicit nonceStart, then nonce (string/number), else 0
  const nonce =
    typeof api.nonceStart === "number"
      ? api.nonceStart
      : toInt(api.nonce, 0);

  return {
    jobId: String(api.jobId),
    data: String(api.data) as `0x${string}`,
    suffix,
    difficulty: { zeros, suffix },
    nonce,
    height: toInt(api.height, 0),
    ttlMs,
    expiresAt,
  };
}
