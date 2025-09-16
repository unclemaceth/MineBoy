import type { ApiJob } from '@/types/api';
import type { MiningJob } from '@/types/mining';

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return fallback;
}

export function normalizeJob(j: ApiJob): MiningJob {
  const nonceNum =
    typeof j.nonce === 'string' ? parseInt(j.nonce, 16) :
    typeof j.nonce === 'number' ? j.nonce : 0;

  const target = (j.suffix ?? j.target ?? '000000').toString();
  const zeros = target.length;
  const targetBits = zeros * 4;
  const difficultyBits = targetBits;

  const ttlMs = num(j.ttlMs, 30_000);
  const expiresAt = num(j.expiresAt, Date.now() + ttlMs);

  return {
    id: j.jobId,
    jobId: j.jobId,
    data: j.data as `0x${string}`,
    nonce: Number.isFinite(nonceNum) ? nonceNum : 0,

    target,
    targetBits,
    difficultyZeros: zeros,
    difficultyBits,
    bits: difficultyBits,

    rule: 'suffix',
    height: num(j.height, 0),
    ttlMs,
    expiresAt,
  };
}
