'use client'

import { ReactNode } from 'react'
import { GlyphWalletProvider as GlyphProvider } from '@use-glyph/sdk-react'
import { apechain } from '@/lib/wallet'

// Create a mutable array for GlyphWalletProvider
const chains = [apechain]

export default function GlyphWalletProvider({ children }: { children: ReactNode }) {
  return (
    <GlyphProvider chains={chains} askForSignature={false}>
      {children}
    </GlyphProvider>
  )
}
