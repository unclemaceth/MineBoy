'use client';

import { ReactNode } from 'react';
import { GlyphWalletProvider } from '@use-glyph/sdk-react';
import { apechain } from '@/lib/wallet';

// Separate Glyph provider that doesn't interfere with main Web3Modal
// Glyph is specifically designed for ApeChain, so we only include that chain
export default function GlyphProvider({ children }: { children: ReactNode }) {
  return (
    <GlyphWalletProvider 
      chains={[apechain]}
      askForSignature={true}
      onLogin={() => console.log('[Glyph] Login successful')}
      onLogout={() => console.log('[Glyph] Logout')}
    >
      {children}
    </GlyphWalletProvider>
  );
}
