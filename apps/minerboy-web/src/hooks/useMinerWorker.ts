import { useEffect, useMemo, useRef, useState } from 'react';

// Local Job type definition (matches @minerboy/shared/mining)
interface Job {
  jobId: string;
  algo: 'sha256-suffix';
  charset: 'hex';
  nonce: string;        // 0x...
  expiresAt: number;    // epoch ms
  // difficulty
  rule: 'suffix';
  suffix: string;       // required suffix (e.g., "00", "000", "0000")
  epoch: number;
  ttlMs: number;
}

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
      const msg = e.data;
      if (msg.type === 'TICK') {
        events.onTick?.(msg.attempts, msg.hr);
      } else if (msg.type === 'FOUND') {
        setRunning(false);
        events.onFound?.(msg);
      } else if (msg.type === 'ERROR') {
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
          algo: job.algo,
          suffix: job.suffix.toLowerCase(),
          charset: job.charset,
          nonce: job.nonce,
          // New difficulty fields
          rule: job.rule,
          difficultyBits: job.difficultyBits,
          targetBits: job.targetBits,
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
