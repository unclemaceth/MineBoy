'use client'
import { useEffect, useState } from 'react'
import { useWalletClient } from 'wagmi'           // Glyph signer
import { getWalletClient } from 'wagmi/actions'   // WC signer
import { wagmiConfig as wcConfig } from '@/lib/wallet'
import { useWalletStore } from '@/state/wallet'

export function useActiveWalletClient() {
  const { data: glyphClient } = useWalletClient()
  const { source } = useWalletStore()
  const [client, setClient] = useState<any>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (glyphClient) return setClient(glyphClient)
      if (source === 'wc') {
        try { const c = await getWalletClient(wcConfig); if (mounted) setClient(c) } catch {}
      } else {
        setClient(null)
      }
    })()
    return () => { mounted = false }
  }, [glyphClient, source])

  return client
}
