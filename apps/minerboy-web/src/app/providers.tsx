'use client';

import { ReactNode, useEffect } from 'react';
import { GlyphWalletProvider } from '@use-glyph/sdk-react';
import { createWeb3Modal } from '@web3modal/wagmi/react';
import { apechain, wagmiConfig, projectId } from '@/lib/wallet';
import DebugTextGuard from '@/components/DebugTextGuard';

// Initialize Web3Modal once when the provider mounts
function Web3ModalInitializer() {
  useEffect(() => {
    if (typeof window !== 'undefined' && projectId && !(window as any).__W3M__) {
      console.log('[MineBoy] Initializing Web3Modal in provider');
      try {
        createWeb3Modal({
          wagmiConfig,
          projectId,
          themeMode: 'dark',
          enableAnalytics: false,
          enableOnramp: false
        });
        (window as any).__W3M__ = true;
        console.log('[MineBoy] Web3Modal initialized successfully');
      } catch (error) {
        console.error('[MineBoy] Web3Modal initialization failed:', error);
      }
    }
  }, []);

  return null;
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <GlyphWalletProvider chains={[apechain]} askForSignature={false}>
      <Web3ModalInitializer />
      <DebugTextGuard />
      {children}
    </GlyphWalletProvider>
  );
}