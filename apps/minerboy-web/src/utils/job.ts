import type { MiningJob } from '@/types/mining';

export function getJobId(job?: MiningJob): string | undefined {
  return job?.id ?? job?.jobId;
}

export function assertString(v: unknown, name: string): asserts v is string {
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error(`${name} missing`);
  }
}
