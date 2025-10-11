'use client';
import { useEffect } from 'react';
import { switchChain } from 'wagmi/actions';
import { wagmiConfig, apechain } from '@/lib/wallet';
import { useActiveAccount } from '@/hooks/useActiveAccount';

export default function WCChainGuard() {
  const { isConnected, provider } = useActiveAccount();

  useEffect(() => {
    if (!isConnected || provider !== 'wc') return;
    switchChain(wagmiConfig, { chainId: apechain.id }).catch(() => {});
  }, [isConnected, provider]);

  return null;
}

