'use client';

import { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GlyphProvider } from '@use-glyph/sdk-react';
import { StrategyType, WalletClientType } from '@use-glyph/sdk-react';
import { wagmiConfig } from '@/lib/wallet';

// Single QueryClient instance
const qc = new QueryClient();

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        <GlyphProvider 
          strategy={StrategyType.EIP1193}
          walletClientType={WalletClientType.WAGMI}
          askForSignature={true}
          onLogin={() => console.log('[Glyph] Login successful')}
          onLogout={() => console.log('[Glyph] Logout')}
        >
          {children}
        </GlyphProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}