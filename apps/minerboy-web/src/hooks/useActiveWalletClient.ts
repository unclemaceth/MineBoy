'use client'
import { useEffect, useState } from 'react'
import { useWalletClient } from 'wagmi'           // Glyph signer
import { useActiveAccount } from './useActiveAccount'
import { wagmiConfig as wcConfig } from '@/lib/wallet'
import { createWalletClient, custom } from 'viem'
import { apechain } from '@/lib/wallet'

export function useActiveWalletClient() {
  const { data: glyphClient } = useWalletClient()
  const { provider, address } = useActiveAccount()
  const [client, setClient] = useState<any>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (provider === 'glyph' && glyphClient) {
        setClient(glyphClient)
      } else if (provider === 'wc' && address) {
        try {
          // For Web3Modal, get the connected provider from window.ethereum
          // This will be the WalletConnect provider after connection
          if (typeof window !== 'undefined' && (window as any).ethereum) {
            const wcClient = createWalletClient({
              account: address as `0x${string}`,
              chain: apechain,
              transport: custom((window as any).ethereum)
            })
            if (mounted) setClient(wcClient)
          } else {
            if (mounted) setClient(null)
          }
        } catch (e) {
          console.warn('Failed to create Web3Modal wallet client:', e)
          if (mounted) setClient(null)
        }
      } else {
        setClient(null)
      }
    })()
    return () => { mounted = false }
  }, [glyphClient, provider, address])

  return client
}
