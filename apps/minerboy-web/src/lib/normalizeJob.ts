import type { ApiJob } from '@/types/api';
import type { MiningJob } from '@/types/mining';

export function normalizeJob(api: ApiJob): MiningJob {
  return {
    id: api.jobId,                                        // map jobId -> id
    data: api.data,
    target: api.target ?? api.suffix ?? '000000',         // suffix fallback
    rule: api.difficulty?.rule ?? 'suffix',
    bits: api.difficulty?.bits ?? api.difficulty?.targetBits,
    targetBits: api.difficulty?.targetBits,
    height: api.height ?? 0,
    // Only keep nonce if it's a string/hex; never coerce to number
    nonce: typeof api.nonce === 'string' ? (api.nonce as `0x${string}`) : undefined,
  };
}