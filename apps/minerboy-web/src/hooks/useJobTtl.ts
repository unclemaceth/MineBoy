import { useEffect, useState } from 'react';
import type { MiningJob } from '@/types/mining';

export function useJobTtl(job?: MiningJob) {
  const compute = () => {
    if (!job) return undefined;
    if (typeof job.expiresAt === 'number') {
      return Math.max(0, Math.floor((job.expiresAt - Date.now()) / 1000));
    }
    if (typeof job.ttlSec === 'number') {
      // ttlSec alone is static; we only show it if expiresAt is missing
      return Math.max(0, Math.floor(job.ttlSec));
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
