'use client';
import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useWalletStore } from '@/state/wallet';

export function useActiveAccount() {
  const [ready, setReady] = useState(false);
  const glyph = useAccount();
  const { externalAddress, source } = useWalletStore();

  useEffect(() => setReady(true), []);
  if (!ready) return { address: undefined, isConnected: false, provider: null as any };

  const address = glyph.address ?? externalAddress ?? undefined;
  const isConnected = Boolean(address);
  const provider = glyph.isConnected ? 'glyph' : (source ?? 'wc');

  return { address, isConnected, provider } as const;
}
