'use client';
import { ReactNode, useState } from 'react';
import { WagmiConfig } from 'wagmi';
import { wagmiConfig } from '@/lib/wallet';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export default function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={qc}>
      <WagmiConfig config={wagmiConfig}>{children}</WagmiConfig>
    </QueryClientProvider>
  );
}
