'use client';

import { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/lib/wallet';
import DebugTextGuard from '@/components/DebugTextGuard';

// Single QueryClient instance
const qc = new QueryClient();

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        <DebugTextGuard />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}