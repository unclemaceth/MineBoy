'use client'

import { useEffect } from 'react'
import { getAccount, watchAccount } from 'wagmi/actions'
import { wagmiConfig as wcConfig } from '@/lib/wallet'     // <-- your multi-connector config
import { useWalletStore } from '@/state/wallet'

export default function WCAccountBridge() {
  useEffect(() => {
    // seed value
    const a = getAccount(wcConfig)
    useWalletStore.getState().setExternalAddress(a.address ?? null, a.address ? 'wc' : null)

    // watch changes from WC instance
    const unwatch = watchAccount(wcConfig, {
      onChange(account: any) {
        useWalletStore.getState().setExternalAddress(account.address ?? null, account.address ? 'wc' : null)
      }
    })
    return unwatch
  }, [])

  return null
}
