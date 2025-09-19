'use client';
import { ReactNode, useState } from 'react';
import { WagmiConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig, chains } from '@/lib/wallet';
import { GlyphWalletProvider } from '@use-glyph/sdk-react';
import GlyphBridge from '@/components/GlyphBridge';

export default function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={qc}>
      <WagmiConfig config={wagmiConfig}>
        <GlyphWalletProvider chains={chains as any} askForSignature={false}>
          <GlyphBridge />
          {children}
        </GlyphWalletProvider>
      </WagmiConfig>
    </QueryClientProvider>
  );
}
