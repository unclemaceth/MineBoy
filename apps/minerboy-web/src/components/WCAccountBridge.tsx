'use client';
import { useEffect, useRef } from 'react';
import { getAccount, watchAccount, watchChainId } from 'wagmi/actions';
import { wagmiConfig } from '@/lib/wallet';
import { useWalletStore } from '@/state/wallet';

export default function WCAccountBridge() {
  const last = useRef<string | null>(null);

  useEffect(() => {
    const seed = getAccount(wagmiConfig);
    const seedAddr = seed?.address ? seed.address.toLowerCase() : null;

    if (seedAddr) {
      useWalletStore.getState().setExternalAddress(seed.address as `0x${string}`, 'wc');
      last.current = seedAddr;
    } else {
      useWalletStore.getState().setExternalAddress(null, null);
      last.current = null;
    }

    const unwatchAcc = watchAccount(wagmiConfig, {
      onChange(acc) {
        const next = acc?.address ? acc.address.toLowerCase() : null;
        if (next !== last.current) {
          last.current = next;
          useWalletStore.getState().setExternalAddress(
            (next as `0x${string}`) ?? null,
            next ? 'wc' : null
          );
        }
      }
    });

    const unwatchChain = watchChainId(wagmiConfig, { onChange: () => {} });

    return () => {
      unwatchAcc?.();
      unwatchChain?.();
    };
  }, []);

  return null;
}
