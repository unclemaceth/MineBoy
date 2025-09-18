import { useConnect } from 'wagmi'
import { walletConnect } from 'wagmi/connectors'
import { openWalletDeepLink, type WalletKey } from '@/utils/walletDeepLinks'

/**
 * Custom hook for opening wallet apps with proper deep linking
 */
export function useOpenWalletApp() {
  const { connectAsync } = useConnect()

  return async function openWallet(wallet: WalletKey) {
    try {
      console.log(`[Wallet App] Opening ${wallet}...`)
      
      // 1) Create WalletConnect connector with showQrModal: false
      const wc = walletConnect({
        projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
        showQrModal: false, // critical for custom UI / deep-links
        metadata: {
          name: 'MineBoy',
          description: 'MineBoy miner',
          url: typeof window !== 'undefined' ? window.location.origin : 'https://minerboy.app',
          icons: ['https://minerboy.app/icon.png']
        }
      })

      // 2) Subscribe to display_uri BEFORE connect() to keep the user gesture
      const provider: any = await wc.getProvider()
      
      const handleUri = (uri: string) => {
        console.log(`[Wallet App] Received WC URI:`, uri.length, 'chars')
        openWalletDeepLink(wallet, uri)
      }

      // Check if provider already has a URI
      if (provider?.connector?.uri) {
        handleUri(provider.connector.uri)
      } else {
        // Listen for the URI event
        provider.once?.('display_uri', handleUri)
        provider.on?.('display_uri', handleUri)
      }

      // 3) Start the connection (no QR modal)
      await connectAsync({ connector: wc })
      
    } catch (error) {
      console.error(`[Wallet App] Failed to open ${wallet}:`, error)
      throw error
    }
  }
}
