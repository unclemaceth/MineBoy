'use client'

import { useEffect } from 'react'
import { createWeb3Modal } from '@web3modal/wagmi/react'
import { wagmiConfig, apechain } from '@/lib/wallet'   // ✅ import config directly

export default function W3MInit() {
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__w3mInited) return
    const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID
    if (!projectId) {
      console.warn('[W3M] Missing NEXT_PUBLIC_WC_PROJECT_ID')
      return
    }

    createWeb3Modal({
      wagmiConfig,                 // ✅ multi-connector config
      projectId,
      defaultChain: apechain,
      enableAnalytics: false
    })
    ;(window as any).__w3mInited = true
    console.log('[W3M] Web3Modal initialized successfully')
  }, [])

  return null
}
