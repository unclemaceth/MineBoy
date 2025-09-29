'use client'

import { useEffect } from 'react'
import { getAccount, watchAccount } from 'wagmi/actions'   // ✅ from actions
import { wagmiConfig as wcConfig } from '@/lib/wallet'     // your multi-connector config
import { useWalletStore } from '@/state/wallet'

export default function WCAccountBridge() {
  useEffect(() => {
    // seed once
    const seed = getAccount(wcConfig)
    useWalletStore.getState().setExternalAddress(
      (seed.address as `0x${string}`) ?? null,
      seed.address ? 'wc' : null
    )

    // watch changes from WC instance
    const unwatch = watchAccount(wcConfig, {
      onChange(account) {
        const addr = (account.address as `0x${string}` | undefined) ?? null
        useWalletStore.getState().setExternalAddress(addr, addr ? 'wc' : null)
      }
    })
    return unwatch
  }, [])

  return null
}
