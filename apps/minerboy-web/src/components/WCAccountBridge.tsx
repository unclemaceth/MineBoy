'use client'

import { useEffect } from 'react'
import { getAccount, watchAccount } from 'wagmi/actions'   // ✅ from actions
import { wagmiConfig as wcConfig } from '@/lib/wallet'     // your multi-connector config
import { useWalletStore } from '@/state/wallet'

export default function WCAccountBridge() {
  useEffect(() => {
    console.log('[WCAccountBridge] Initializing bridge...')
    
    // seed once
    const seed = getAccount(wcConfig)
    console.log('[WCAccountBridge] Seed account:', seed.address)
    
    useWalletStore.getState().setExternalAddress(
      (seed.address as `0x${string}`) ?? null,
      seed.address ? 'wc' : null
    )
    
    console.log('[WCAccountBridge] Set seed address:', seed.address)

    // watch changes from WC instance
    const unwatch = watchAccount(wcConfig, {
      onChange(account) {
        console.log('[WCAccountBridge] Account changed:', account.address)
        const addr = (account.address as `0x${string}` | undefined) ?? null
        useWalletStore.getState().setExternalAddress(addr, addr ? 'wc' : null)
        console.log('[WCAccountBridge] Updated store with address:', addr)
      }
    })
    
    console.log('[WCAccountBridge] Bridge initialized, watching for changes...')
    return unwatch
  }, [])

  return null
}
