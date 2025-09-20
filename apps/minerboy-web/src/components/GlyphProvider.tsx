'use client';

import { ReactNode } from 'react';
import { GlyphWalletProvider } from '@use-glyph/sdk-react';
import { wagmiConfig } from '@/lib/wallet';

// Separate Glyph provider that doesn't interfere with main Web3Modal
export default function GlyphProvider({ children }: { children: ReactNode }) {
  return (
    <GlyphWalletProvider 
      chains={[...wagmiConfig.chains]}
      askForSignature={true}
      onLogin={() => console.log('[Glyph] Login successful')}
      onLogout={() => console.log('[Glyph] Logout')}
    >
      {children}
    </GlyphWalletProvider>
  );
}
