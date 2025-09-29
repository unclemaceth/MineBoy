'use client'
import { useEffect } from 'react'
import { useAccount } from 'wagmi' // Glyph context
import { useWalletStore } from '@/state/wallet'

export function useActiveAccount() {
  const glyph = useAccount()
  const { externalAddress, source } = useWalletStore()

  const address = glyph.address ?? externalAddress ?? undefined
  const isConnected = Boolean(address)
  const provider = glyph.isConnected ? 'glyph' : (source ?? 'wc')

  // Debug logging
  useEffect(() => {
    console.log('[useActiveAccount] State:', {
      glyphAddress: glyph.address,
      glyphConnected: glyph.isConnected,
      externalAddress,
      source,
      finalAddress: address,
      finalConnected: isConnected,
      provider
    })
  }, [glyph.address, glyph.isConnected, externalAddress, source, address, isConnected, provider])

  return { address, isConnected, provider } as const
}
