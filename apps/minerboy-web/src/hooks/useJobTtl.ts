import { useEffect, useState } from 'react';
import type { MiningJob } from '@/types/mining';

export function useJobTtl(job?: MiningJob) {
  const compute = () => {
    if (!job) return undefined;
    if (typeof job.ttlSec === 'number') return Math.max(0, Math.floor(job.ttlSec));
    if (typeof job.expiresAt === 'number') {
      return Math.max(0, Math.floor((job.expiresAt - Date.now()) / 1000));
    }
    return undefined;
  };

  const [ttl, setTtl] = useState<number | undefined>(compute);

  useEffect(() => {
    setTtl(compute());
    const id = setInterval(() => setTtl(compute()), 1000);
    return () => clearInterval(id);
  }, [job?.id, job?.ttlSec, job?.expiresAt]);

  return ttl;
}
