'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getOrCreateSessionId, clearSessionId } from '@/lib/miningSession';
import { apiStart, apiHeartbeat, apiStop, type ErrRes } from '@/lib/miningApi';

export type MinerState =
  | 'idle'
  | 'starting'
  | 'running'
  | 'blocked'   // ownership or session conflict
  | 'expired'   // session/ownership expired
  | 'error';

export interface UseMinerSessionOpts {
  tokenId: number;
  wallet: `0x${string}` | undefined;
  chainId: number | undefined;
  contract: `0x${string}` | undefined;
  heartbeatMs?: number;        // default 20_000
}

export function useMinerSession(opts: UseMinerSessionOpts) {
  const { tokenId, wallet, chainId, contract } = opts;
  const hbMs = opts.heartbeatMs ?? 20_000;

  const sessionId = useMemo(() => getOrCreateSessionId(tokenId), [tokenId]);
  const [state, setState] = useState<MinerState>('idle');
  const [err, setErr] = useState<ErrRes | null>(null);
  const [ownershipTtl, setOwnershipTtl] = useState<number | undefined>();
  const hbTimer = useRef<number | null>(null);

  const ready = Boolean(wallet && chainId && contract);

  async function start() {
    if (!ready) return;
    setState('starting'); 
    setErr(null);
    
    try {
      const res = await apiStart({ 
        wallet: wallet!, 
        chainId: chainId!, 
        contract: contract!, 
        tokenId, 
        sessionId 
      });
      setOwnershipTtl(res.ownershipTtlSec);
      setState('running');
    } catch (e: any) {
      const er = e as ErrRes;
      setErr(er);
      setState(
        er.code === 'cartridge_in_use' || 
        er.code === 'active_session_elsewhere' || 
        er.code === 'session_still_active' ? 'blocked' : 'error'
      );
    }
  }

  async function stop() {
    if (!ready) return;
    
    try { 
      await apiStop({ 
        wallet: wallet!, 
        chainId: chainId!, 
        contract: contract!, 
        tokenId, 
        sessionId 
      }); 
    } finally {
      if (hbTimer.current) window.clearInterval(hbTimer.current);
      hbTimer.current = null;
      setState('idle'); 
      setErr(null);
      // keep sessionId to allow resume; call clearSessionId(tokenId) only if you want a fresh session
    }
  }

  // heartbeats
  useEffect(() => {
    if (state !== 'running' || !ready) return;
    
    async function tick() {
      try {
        const r = await apiHeartbeat({ 
          wallet: wallet!, 
          chainId: chainId!, 
          contract: contract!, 
          tokenId, 
          sessionId 
        });
        // optional: use r.sessionTtlSec
      } catch (e: any) {
        const er = e as ErrRes;
        setErr(er);
        if (er.code === 'session_expired' || er.code === 'lock_expired') {
          setState('expired');
        } else {
          setState('blocked');
        }
      }
    }
    
    // fire immediately then start interval
    tick();
    hbTimer.current = window.setInterval(tick, hbMs) as unknown as number;
    
    return () => { 
      if (hbTimer.current) {
        window.clearInterval(hbTimer.current);
        hbTimer.current = null;
      }
    };
  }, [state, ready, wallet, chainId, contract, tokenId, sessionId, hbMs]);

  return { state, err, start, stop, sessionId, ownershipTtl };
}
