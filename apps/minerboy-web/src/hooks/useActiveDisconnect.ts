'use client'
import { useDisconnect } from 'wagmi' // Glyph disconnect
import { useWeb3Modal } from '@web3modal/wagmi/react' // Web3Modal disconnect
import { useWalletStore } from '@/state/wallet'

export function useActiveDisconnect() {
  const { disconnect } = useDisconnect() // Glyph disconnect
  const { close } = useWeb3Modal() // Web3Modal disconnect
  const { source } = useWalletStore()

  const disconnectWallet = async () => {
    console.log('[useActiveDisconnect] Disconnecting, source:', source)
    console.trace('[useActiveDisconnect] Called from:') // 🔍 Find who's calling disconnect
    
    try {
      if (source === 'wc') {
        // Disconnect from Web3Modal
        console.log('[useActiveDisconnect] Disconnecting from Web3Modal')
        await close()
        // Clear the store
        useWalletStore.getState().setExternalAddress(null, null)
      } else {
        // Disconnect from Glyph
        console.log('[useActiveDisconnect] Disconnecting from Glyph')
        disconnect()
      }
    } catch (error) {
      console.error('[useActiveDisconnect] Disconnect error:', error)
    }
  }

  return { disconnectWallet }
}
