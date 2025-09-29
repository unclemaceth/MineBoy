'use client'

import { useEffect } from 'react'
import { createWeb3Modal } from '@web3modal/wagmi/react'
import { useConfig } from 'wagmi'
import { apechain } from '@/lib/wallet'

export default function W3MInit() {
  const config = useConfig()

  useEffect(() => {
    // guard against double init on fast refresh / remounts
    if (typeof window !== 'undefined' && (window as any).__w3mInited) return
    if (!process.env.NEXT_PUBLIC_WC_PROJECT_ID) {
      console.warn('[W3M] Missing NEXT_PUBLIC_WC_PROJECT_ID')
      return
    }
    createWeb3Modal({
      wagmiConfig: config,              // ← SAME wagmi instance Glyph created
      projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!,
      defaultChain: apechain,
      enableAnalytics: false
    })
    ;(window as any).__w3mInited = true
    console.log('[W3M] Web3Modal initialized successfully')
  }, [config])

  return null
}
