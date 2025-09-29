'use client'
import { useAccount } from 'wagmi'             // from Glyph provider
import { useWalletStore } from '@/state/wallet'

export function useActiveAccount() {
  const glyph = useAccount()
  const { externalAddress, source } = useWalletStore()

  // Prefer Glyph if connected, else fall back to WC-bridge address
  const address = glyph.address ?? externalAddress ?? undefined
  const isConnected = Boolean(address)
  const provider = glyph.isConnected ? 'glyph' : (source ?? 'wc')

  return { address, isConnected, provider } as const
}
