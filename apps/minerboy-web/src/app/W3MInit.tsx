'use client'

import { useEffect } from 'react'
import { createWeb3Modal } from '@web3modal/wagmi/react'
import { apechain, wagmiConfig, projectId } from '@/lib/wallet'

export default function W3MInit() {
  useEffect(() => {
    // guard against double init on fast refresh / remounts
    if (typeof window !== 'undefined' && (window as any).__w3mInited) return
    if (!projectId) {
      console.warn('[W3M] Missing NEXT_PUBLIC_WC_PROJECT_ID')
      return
    }
    createWeb3Modal({
      wagmiConfig,                      // ← your multi-connector wagmi
      projectId,
      defaultChain: apechain,
      enableAnalytics: false
    })
    ;(window as any).__w3mInited = true
    console.log('[W3M] Web3Modal initialized successfully')
  }, [])

  return null
}
