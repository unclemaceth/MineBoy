'use client'
import { useEffect, useState } from 'react'
import { useWalletClient } from 'wagmi'           // Glyph signer
import { getWalletClient } from 'wagmi/actions'   // WC signer
import { wagmiConfig as wcConfig } from '@/lib/wallet'
import { useActiveAccount } from './useActiveAccount'
import { useWeb3Modal } from '@web3modal/wagmi/react'

export function useActiveWalletClient() {
  const { data: glyphClient } = useWalletClient()
  const { provider } = useActiveAccount()
  const { open: openWeb3Modal } = useWeb3Modal()
  const [client, setClient] = useState<any>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (provider === 'glyph' && glyphClient) {
        setClient(glyphClient)
      } else if (provider === 'wc') {
        try { 
          const c = await getWalletClient(wcConfig)
          if (mounted) setClient(c) 
        } catch (e) {
          console.warn('Failed to get Web3Modal wallet client:', e)
          // For Web3Modal, return a client object that can trigger the modal
          if (mounted) setClient({ open: openWeb3Modal, type: 'web3modal' })
        }
      } else {
        setClient(null)
      }
    })()
    return () => { mounted = false }
  }, [glyphClient, provider, openWeb3Modal])

  return client
}
