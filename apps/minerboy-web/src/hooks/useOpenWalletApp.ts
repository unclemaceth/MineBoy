/* eslint-disable @typescript-eslint/no-explicit-any */
import { useConnect } from 'wagmi'
import { toDeepLink, WALLET_LINKS, type WalletKey } from '@/utils/walletDeepLinks'

/**
 * Custom hook for opening wallet apps with proper deep linking
 */
export function useOpenWalletApp() {
  const { connectAsync, connectors } = useConnect()

  return async function openWallet(wallet: WalletKey) {
    try {
      console.log(`[Wallet App] Opening ${wallet}...`)
      
      // Find WC connector (id/name can vary)
      const wc = connectors.find((c: any) =>
        String(c.id || c.name || '').toLowerCase().includes('walletconnect')
      ) as any
      if (!wc) throw new Error('WalletConnect connector not configured')

      let navigated = false
      const open = (uri: string) => {
        if (navigated) return
        navigated = true

        const url = toDeepLink(wallet, uri)
        console.log(`[Wallet App] Deep linking to:`, url)
        // IMPORTANT: navigate in the same tab; _blank gets blocked on iOS.
        window.location.href = url

        const store = WALLET_LINKS[wallet].store
        if (store) {
          setTimeout(() => {
            if (!document.hidden) {
              console.log(`[Wallet App] Fallback to store:`, store)
              window.location.href = store
            }
          }, 2000)
        }
      }

      // Subscribe for WC URI BEFORE connect to preserve the user gesture.
      try {
        const provider =
          typeof wc.getProvider === 'function'
            ? await wc.getProvider()
            : (wc.provider ?? undefined)

        provider?.on?.('display_uri', (uri: string) => open(uri))
        if (provider?.connector?.uri) open(provider.connector.uri)
      } catch {
        // ignore; we'll still try to pick the URI from errors below
      }

      // Kick off the connection (make sure your WC connector has showQrModal: false)
      try {
        await connectAsync({ connector: wc })
      } catch (err: any) {
        // Some stacks leak the WC URI on error—use it if available
        const leaked =
          err?.data?.uri ||
          err?.message?.match(/(wc:[^\s"']+)/)?.[1] ||
          undefined
        if (leaked) open(leaked)
        throw err
      }
      
    } catch (error) {
      console.error(`[Wallet App] Failed to open ${wallet}:`, error)
      throw error
    }
  }
}
