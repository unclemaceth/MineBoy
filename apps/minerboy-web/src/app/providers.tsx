'use client';

import { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GlyphWalletProvider } from '@use-glyph/sdk-react';
import { wagmiConfig } from '@/lib/wallet';

// Single QueryClient instance
const qc = new QueryClient();

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        <GlyphWalletProvider 
          chains={[...wagmiConfig.chains]}
          queryClient={qc}
          askForSignature={true}
          onLogin={() => console.log('[Glyph] Login successful')}
          onLogout={() => console.log('[Glyph] Logout')}
        >
          {children}
        </GlyphWalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}