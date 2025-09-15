'use client';

import GlyphWalletWrapper from '@/components/GlyphWalletWrapper';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GlyphWalletWrapper>
      {children}
    </GlyphWalletWrapper>
  );
}
