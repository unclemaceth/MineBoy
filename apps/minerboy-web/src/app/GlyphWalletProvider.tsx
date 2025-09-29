'use client'

import { ReactNode } from 'react'
import { GlyphWalletProvider as GlyphProvider } from '@use-glyph/sdk-react'
import { apechain } from '@/lib/wallet'

const chains = [apechain] as const

export default function GlyphWalletProvider({ children }: { children: ReactNode }) {
  return (
    <GlyphProvider chains={chains} askForSignature={false}>
      {children}
    </GlyphProvider>
  )
}
