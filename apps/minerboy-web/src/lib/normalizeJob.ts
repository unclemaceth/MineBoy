import type { ApiJob } from '@/types/api';
import type { MiningJob } from '@/types/mining';

export function normalizeJob(api: ApiJob): MiningJob {
  // accept either jobId or id from backend
  const id = api.jobId ?? api.id ?? '';

  // prefer "target", fall back to legacy "suffix"
  const target = api.target ?? api.suffix ?? '000000';

  // compute a concrete expiry timestamp if only ttl was sent
  const ttlMs = api.ttlMs ?? (api.ttlSec != null ? api.ttlSec * 1000 : undefined);
  const expiresAt = api.expiresAt ?? (ttlMs != null ? Date.now() + ttlMs : undefined);

  // never coerce nonce to number
  const nonce =
    typeof api.nonce === 'string'
      ? ((api.nonce.startsWith('0x') ? api.nonce : `0x${api.nonce}`) as `0x${string}`)
      : undefined;

  return {
    id,
    jobId: id, // back-compat for UI bits that still read job.jobId
    data: api.data,
    target,
    rule: api.difficulty?.rule ?? 'suffix',
    bits: api.difficulty?.bits ?? api.difficulty?.targetBits,
    targetBits: api.difficulty?.targetBits,
    height: api.height ?? 0,
    nonce,
    expiresAt,
    ttlMs,
    ttlSec: api.ttlSec ?? (expiresAt ? Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)) : undefined),
  };
}