import { useEffect, useMemo, useRef, useState } from 'react';
import type { MiningJob as Job } from '@/types/mining';

type Events = {
  onTick?: (attempts: number, hr: number, hash?: string, nibs?: number[]) => void;
  onFound?: (payload: { hash: string; preimage: string; attempts: number; hr: number }) => void;
  onError?: (message: string) => void;
};

export function useMinerWorker(events: Events = {}) {
  const workerRef = useRef<Worker | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const rateIntervalRef = useRef<number | null>(null);
  const [running, setRunning] = useState(false);
  
  // Session guard to prevent reanimation after TTL expiry
  const sessionIdRef = useRef<string>('');

  // Hard kill with fallback termination
  const hardKill = (reason: string = 'manual') => {
    console.log(`[HARD_KILL] ${reason}`);
    
    // Stop periodic UI updates
    if (rateIntervalRef.current) {
      clearInterval(rateIntervalRef.current);
      rateIntervalRef.current = null;
    }

    const w = workerRef.current;
    if (!w) return;

    try { 
      w.postMessage({ type: 'STOP' }); 
    } catch (e) {
      console.warn('[HARD_KILL] Failed to post STOP message:', e);
    }

    // If cooperative stop fails, terminate after 250ms
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
    }
    
    stopTimerRef.current = window.setTimeout(() => {
      try { 
        w.terminate(); 
        console.log('[HARD_KILL] Worker terminated by timeout');
      } catch (e) {
        console.warn('[HARD_KILL] Failed to terminate worker:', e);
      }
      workerRef.current = null;
    }, 250);

    // Immediately detach handlers so nothing updates the UI
    w.onmessage = null;
    workerRef.current = null;
    setRunning(false);
  };

  useEffect(() => {
    const w = new Worker(new URL('../workers/sha.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = w;
    
    w.onmessage = (e: MessageEvent<unknown>) => {
      const msg = e.data as any;
      
      // Ignore stale messages from previous logical sessions
      if (msg?.sid && sessionIdRef.current !== msg.sid) {
        console.log('[STALE_MSG] Ignoring message from dead session:', msg.sid);
        return;
      }
      
      if (msg?.type === 'TICK') {
        events.onTick?.(msg.attempts, msg.hr, msg.hash, msg.nibs);
      } else if (msg?.type === 'FOUND') {
        setRunning(false);
        events.onFound?.(msg);
      } else if (msg?.type === 'ERROR') {
        setRunning(false);
        events.onError?.(msg.message);
      } else if (msg?.type === 'STOPPED') {
        console.log('[WORKER_STOPPED] Worker confirmed stop');
        setRunning(false);
      }
    };
    
    return () => { 
      hardKill('unmount');
    };
  }, []); // eslint-disable-line

  const api = useMemo(() => ({
    start(job: Job) {
      // Refuse to start if current session was cancelled/expired
      if (!workerRef.current) return;
      
      // Always create a fresh session ID (clears any 'dead' state)
      const sid = crypto.randomUUID();
      sessionIdRef.current = sid;
      setRunning(true);
      
      // Create worker job with compat aliases for existing worker code
      const workerJob = {
        id: job.id,
        // canonical fields we want to use going forward
        data: job.data,
        target: job.target,
        
        // --- COMPAT ALIASES (so the existing worker keeps working) ---
        // many miners historically used `suffix` instead of `target`
        suffix: job.target,
        // many miners used `nonce` / `noncePrefix` as the preimage base
        // our backend's "seed" is in `data`, so mirror it:
        nonce: job.nonce ?? job.data,
        noncePrefix: job.nonce ?? job.data,
        // difficulty bits (optional; won't hurt if unused)
        bits: job.bits,
        targetBits: job.targetBits,
        rule: job.rule ?? 'suffix',
        height: job.height,
      };
      
      // Use simple stop flag (SharedArrayBuffer requires special headers)
      workerRef.current.postMessage({
        type: 'START',
        job: workerJob,
        sid,
      });
      
      console.log(`[START] New mining session: ${sid}`);
    },
    stop() {
      hardKill('manual-stop');
    },
    stopForTtl() {
      console.log('[STOP_TTL] TTL expired, marking session as dead');
      sessionIdRef.current = 'dead';
      hardKill('ttl-expired');
    },
    resetSession() {
      console.log('[RESET_SESSION] Resetting dead session state');
      sessionIdRef.current = crypto.randomUUID();
    },
    running,
  }), [running]);

  return api;
}
