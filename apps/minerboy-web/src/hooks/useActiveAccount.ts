'use client'
import { useAccount } from 'wagmi' // Glyph context
import { useWalletStore } from '@/state/wallet'

export function useActiveAccount() {
  const glyph = useAccount()
  const { externalAddress, source } = useWalletStore()

  const address = glyph.address ?? externalAddress ?? undefined
  const isConnected = Boolean(address)
  const provider = glyph.isConnected ? 'glyph' : (source ?? 'wc')

  return { address, isConnected, provider } as const
}
