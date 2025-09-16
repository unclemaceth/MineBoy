import { useEffect, useMemo, useRef, useState } from 'react';
import type { MiningJob as Job } from '@/types/mining';

type Events = {
  onTick?: (attempts: number, hr: number) => void;
  onFound?: (payload: { hash: string; preimage: string; attempts: number; hr: number }) => void;
  onError?: (message: string) => void;
};

export function useMinerWorker(events: Events = {}) {
  const workerRef = useRef<Worker | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const w = new Worker(new URL('../workers/sha.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = w;
    w.onmessage = (e: MessageEvent<unknown>) => {
      const msg = e.data as any;
      if (msg?.type === 'TICK') {
        events.onTick?.(msg.attempts, msg.hr);
      } else if (msg?.type === 'FOUND') {
        setRunning(false);
        events.onFound?.(msg);
      } else if (msg?.type === 'ERROR') {
        setRunning(false);
        events.onError?.(msg.message);
      }
    };
    return () => { w.terminate(); workerRef.current = null; };
  }, []); // eslint-disable-line

  const api = useMemo(() => ({
    start(job: Job) {
      if (!workerRef.current) return;
      setRunning(true);
      workerRef.current.postMessage({
        type: 'START',
        job: {
          algo: 'sha256-suffix',
          suffix: job.target.toLowerCase(),
          charset: 'hex',
          nonce: job.data,
          rule: job.rule,
          difficultyBits: job.difficultyBits,
        },
      });
    },
    stop() {
      if (!workerRef.current) return;
      setRunning(false);
      workerRef.current.postMessage({ type: 'STOP' });
    },
    running,
  }), [running]);

  return api;
}
