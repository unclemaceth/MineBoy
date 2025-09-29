'use client';

import { ReactNode } from 'react';
import { GlyphWalletProvider } from '@use-glyph/sdk-react';
import { apechain } from '@/lib/wallet';
import DebugTextGuard from '@/components/DebugTextGuard';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <GlyphWalletProvider chains={[apechain]} askForSignature={false}>
      <DebugTextGuard />
      {children}
    </GlyphWalletProvider>
  );
}