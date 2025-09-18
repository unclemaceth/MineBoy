/**
 * Wallet Deep Link Utilities
 * Handles proper deep linking to wallet apps on mobile devices
 */

export type WalletKey = 'metamask' | 'coinbase' | 'rainbow' | 'trust' | 'okx'

export const WALLET_LINKS: Record<WalletKey, {
  ios: string;        // universal link preferred on iOS
  android?: string;   // native scheme or universal on Android
  store?: string;     // optional fallback
}> = {
  metamask: {
    ios: 'https://metamask.app.link/wc?uri=',
    android: 'metamask://wc?uri=',
    store: 'https://apps.apple.com/app/metamask/id1438144202'
  },
  coinbase: {
    ios: 'https://go.cb-w.com/wc?uri=',
    android: 'cbwallet://wc?uri=',
    store: 'https://apps.apple.com/app/coinbase-wallet/id1278383455'
  },
  rainbow: {
    ios: 'https://rnbwapp.com/wc?uri=',
    android: 'rainbow://wc?uri='
  },
  trust: {
    ios: 'https://link.trustwallet.com/wc?uri=',
    android: 'trust://wc?uri='
  },
  okx: {
    ios: 'https://www.okx.com/wallet/wc?uri=',
    android: 'okx://wc?uri='
  }
}

export const isIOS = () => typeof navigator !== 'undefined' ? /iPhone|iPad|iPod/i.test(navigator.userAgent) : false
export const isAndroid = () => typeof navigator !== 'undefined' ? /Android/i.test(navigator.userAgent) : false

/**
 * Build a deep link URL for a specific wallet
 */
export function toDeepLink(wallet: WalletKey, wcUri: string): string {
  const base = isIOS()
    ? WALLET_LINKS[wallet].ios
    : (WALLET_LINKS[wallet].android || WALLET_LINKS[wallet].ios)
  return `${base}${encodeURIComponent(wcUri)}`
}

/**
 * Navigate to wallet deep link with fallback to store
 */
export function openWalletDeepLink(wallet: WalletKey, wcUri: string): void {
  const url = toDeepLink(wallet, wcUri)
  const store = WALLET_LINKS[wallet].store
  
  console.log(`[Wallet Deep Link] Opening ${wallet}:`, url)
  
  // Navigate in the SAME tab (_self); no window.open/_blank
  window.location.href = url

  // Optional fallback to store if the app isn't installed
  if (store) {
    setTimeout(() => {
      // if we're still here after ~2s, send to store
      if (!document.hidden) {
        console.log(`[Wallet Deep Link] Fallback to store:`, store)
        window.location.href = store
      }
    }, 2000)
  }
}

/**
 * Get available wallets for the current platform
 */
export function getAvailableWallets(): WalletKey[] {
  if (isIOS()) {
    return ['metamask', 'coinbase', 'rainbow', 'trust', 'okx']
  } else if (isAndroid()) {
    return ['metamask', 'coinbase', 'trust', 'okx']
  }
  return ['metamask', 'coinbase'] // fallback
}
