'use client'

import { ReactNode } from 'react'
import { GlyphWalletProvider as GlyphProvider } from '@use-glyph/sdk-react'
import type { Chain } from 'viem'

// Create a mutable ApeChain object for GlyphWalletProvider
const apechain: Chain = {
  id: 33139,
  name: 'ApeChain',
  nativeCurrency: { name: 'ApeCoin', symbol: 'APE', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.apechain.com/http'] } },
  blockExplorers: { default: { name: 'ApeScan', url: 'https://apescan.io' } }
}

const chains = [apechain] as [Chain, ...Chain[]]

export default function GlyphWalletProvider({ children }: { children: ReactNode }) {
  return (
    <GlyphProvider chains={chains} askForSignature={false}>
      {children}
    </GlyphProvider>
  )
}
