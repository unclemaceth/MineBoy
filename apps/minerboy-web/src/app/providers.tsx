'use client';
import { ReactNode, useState } from 'react';
import { WagmiConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/lib/wallet';
import { GlyphProvider, StrategyType, WalletClientType } from '@use-glyph/sdk-react';

export default function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={qc}>
      <WagmiConfig config={wagmiConfig}>
        <GlyphProvider strategy={StrategyType.EIP1193} walletClientType={WalletClientType.WAGMI}>
          {children}
        </GlyphProvider>
      </WagmiConfig>
    </QueryClientProvider>
  );
}
