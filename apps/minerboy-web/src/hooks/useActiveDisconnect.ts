'use client'
import { useCallback } from 'react'
import { useDisconnect } from 'wagmi'
import { useWalletStore } from '@/state/wallet'

export function useActiveDisconnect() {
  const { disconnectAsync } = useDisconnect()
  const { source } = useWalletStore()

  const disconnectWallet = useCallback(async (reason?: string) => {
    console.warn('[useActiveDisconnect] disconnect', { source, reason })
    console.trace()
    try {
      await disconnectAsync() // ← works for WC and Glyph
    } finally {
      useWalletStore.getState().setExternalAddress(null, null)
    }
  }, [source, disconnectAsync])

  return { disconnectWallet }
}
