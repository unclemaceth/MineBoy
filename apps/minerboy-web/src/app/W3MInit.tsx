'use client';
import { useEffect, useRef } from 'react';
import { createWeb3Modal } from '@web3modal/wagmi/react';
import { wagmiConfig, apechain } from '@/lib/wallet';

export default function W3MInit() {
  const once = useRef(false);

  useEffect(() => {
    if (once.current || (window as any).__w3mInited) return;

    const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;
    if (!projectId) {
      console.warn('[W3M] Missing NEXT_PUBLIC_WC_PROJECT_ID');
      return;
    }

    createWeb3Modal({
      wagmiConfig,
      projectId,
      defaultChain: apechain,
      enableAnalytics: false,
      enableOnramp: false,
      themeMode: 'dark'
    });

    (window as any).__w3mInited = true;
    once.current = true;
    console.log('[W3M] Initialized');
  }, []);

  return null;
}
