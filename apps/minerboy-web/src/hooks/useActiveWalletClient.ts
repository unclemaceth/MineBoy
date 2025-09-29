'use client'
import { useMemo } from 'react'
import { useWalletClient } from 'wagmi'         // Glyph context
import { getWalletClient } from 'wagmi/actions'
import { wagmiConfig as wcConfig } from '@/lib/wallet'
import { useWalletStore } from '@/state/wallet'

export function useActiveWalletClient() {
  const glyph = useWalletClient()
  const { source } = useWalletStore()

  return useMemo(async () => {
    if (glyph.data) return glyph.data                           // Glyph signer
    if (source === 'wc') {
      try { return await getWalletClient(wcConfig) } catch { return null }
    }
    return null
  }, [glyph.data, source])
}
