import { useEffect, useMemo, useRef, useState } from 'react';
import type { MiningJob as Job } from '@/types/mining';

type Events = {
  onTick?: (data: { 
    attempts: number; 
    hr: number; 
    hash?: string; 
    nibs?: number[];
    // ANTI-BOT: Progress tracking
    counter?: number;
    progress?: number;
    estimatedSecondsLeft?: number;
  }) => void;
  onFound?: (payload: { 
    hash: string; 
    preimage: string; 
    attempts: number; 
    hr: number;
    counter?: number;
  }) => void;
  onError?: (message: string) => void;
  onStopped?: (reason: string) => void; // NEW: Handle STOPPED message
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
        // ANTI-BOT: Pass full tick data including progress
        events.onTick?.({
          attempts: msg.attempts,
          hr: msg.hr,
          hash: msg.hash,
          nibs: msg.nibs,
          counter: msg.counter,
          progress: msg.progress,
          estimatedSecondsLeft: msg.estimatedSecondsLeft,
        });
      } else if (msg?.type === 'FOUND') {
        setRunning(false);
        events.onFound?.({
          hash: msg.hash,
          preimage: msg.preimage,
          attempts: msg.attempts,
          hr: msg.hr,
          counter: msg.counter,
        });
      } else if (msg?.type === 'ERROR') {
        setRunning(false);
        events.onError?.(msg.message);
      } else if (msg?.type === 'STOPPED') {
        console.log('[WORKER_STOPPED] Worker stopped:', msg.reason);
        setRunning(false);
        events.onStopped?.(msg.reason || 'unknown');
      }
    };
    
    return () => { 
      hardKill('unmount');
    };
  }, []); // eslint-disable-line

  const api = useMemo(() => ({
    start(job: Job) {
      // Recreate worker if it was killed (e.g. after TTL timeout)
      if (!workerRef.current) {
        console.log('[WORKER_RECREATE] Worker was null, creating new worker');
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
            // ANTI-BOT: Pass full tick data including progress
            events.onTick?.({
              attempts: msg.attempts,
              hr: msg.hr,
              hash: msg.hash,
              nibs: msg.nibs,
              counter: msg.counter,
              progress: msg.progress,
              estimatedSecondsLeft: msg.estimatedSecondsLeft,
            });
          } else if (msg?.type === 'FOUND') {
            setRunning(false);
            events.onFound?.({
              hash: msg.hash,
              preimage: msg.preimage,
              attempts: msg.attempts,
              hr: msg.hr,
              counter: msg.counter,
            });
          } else if (msg?.type === 'ERROR') {
            setRunning(false);
            events.onError?.(msg.message);
          } else if (msg?.type === 'STOPPED') {
            console.log('[WORKER_STOPPED] Worker stopped:', msg.reason);
            setRunning(false);
            events.onStopped?.(msg.reason || 'unknown');
          }
        };
      }
      
      // Always create a fresh session ID (clears any 'dead' state)
      const sid = crypto.randomUUID();
      sessionIdRef.current = sid;
      setRunning(true);
      
      // ANTI-BOT: Create worker job with REQUIRED fields
      const workerJob = {
        algo: 'sha256-suffix' as const,
        charset: 'hex' as const,
        nonce: job.nonce ?? job.data,
        
        // ANTI-BOT REQUIRED FIELDS
        counterStart: job.counterStart ?? 0,
        counterEnd: job.counterEnd ?? 100000,
        maxHps: job.maxHps ?? 5000,
        allowedSuffixes: job.allowedSuffixes ?? [],
        
        // DEPRECATED (kept for backward compat warnings)
        suffix: job.target,
        rule: job.rule ?? 'suffix',
      };
      
      // Validate required fields
      if (!workerJob.nonce) {
        console.error('[START] Job missing nonce');
        events.onError?.('Job missing nonce');
        setRunning(false);
        return;
      }
      
      if (!workerJob.allowedSuffixes || workerJob.allowedSuffixes.length === 0) {
        console.error('[START] Job missing allowedSuffixes');
        events.onError?.('Job missing allowedSuffixes - refresh to upgrade');
        setRunning(false);
        return;
      }
      
      console.log(`[START] New STRICT mining session: ${sid}, counter [${workerJob.counterStart}, ${workerJob.counterEnd}), maxHps=${workerJob.maxHps}`);
      
      workerRef.current.postMessage({
        type: 'START',
        job: workerJob,
        sid,
      });
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
