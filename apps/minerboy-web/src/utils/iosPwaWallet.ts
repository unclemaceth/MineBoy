/**
 * iOS PWA Wallet Connection Utilities
 * Handles the special case of connecting wallets in iOS Safari PWA mode
 */

// Detect iOS PWA environment (client-side only)
export const isiOS = typeof navigator !== 'undefined' ? /iPhone|iPad|iPod/i.test(navigator.userAgent) : false;
export const isStandalone = typeof window !== 'undefined' ? window.matchMedia('(display-mode: standalone)').matches : false;
export const isiOSPWA = isiOS && isStandalone;

// Debug logging (client-side only)
if (typeof window !== 'undefined') {
  console.log('[iOS PWA] Detection:', {
    isiOS,
    isStandalone,
    isiOSPWA,
    userAgent: navigator.userAgent,
    displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'
  });
}

// Pre-opened window for deep linking (reserved on user gesture)
let deeplinkWin: Window | null = null;

/**
 * Reserve a window for deep linking on user gesture
 * Must be called synchronously during a user click/tap
 */
export function reserveDeepLinkWindow(): void {
  if (typeof window !== 'undefined' && isiOSPWA) {
    try {
      deeplinkWin = window.open('', '_blank');
      console.log('[iOS PWA] Reserved deep link window');
    } catch (error) {
      console.warn('[iOS PWA] Failed to reserve window:', error);
    }
  }
}

/**
 * Build universal links for different wallets
 * Uses https:// links instead of custom schemes for better iOS PWA compatibility
 */
export function buildUniversalLink(wallet: 'metamask' | 'coinbase' | 'generic', wcUri: string): string {
  const enc = encodeURIComponent(wcUri);
  
  switch (wallet) {
    case 'metamask':
      return `https://metamask.app.link/wc?uri=${enc}`;
    case 'coinbase':
      return `https://go.cb-w.com/wc?uri=${enc}`;
    case 'generic':
    default:
      // WalletConnect universal link router
      return `https://link.walletconnect.com/?uri=${enc}`;
  }
}

/**
 * Open a deep link using the reserved window or current window
 */
export function openDeepLink(url: string): void {
  if (typeof window === 'undefined') return;
  
  console.log('[iOS PWA] Opening deep link:', url);
  
  if (deeplinkWin) {
    try {
      deeplinkWin.location.href = url;
      console.log('[iOS PWA] Used reserved window');
      return;
    } catch (error) {
      console.warn('[iOS PWA] Reserved window failed, falling back:', error);
    }
  }
  
  // Fallback: navigate current window
  window.location.href = url;
}

/**
 * Copy WalletConnect URI to clipboard
 */
export async function copyWalletConnectUri(uri: string): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  
  try {
    await navigator.clipboard.writeText(uri);
    console.log('[iOS PWA] Copied URI to clipboard');
    return true;
  } catch (error) {
    console.warn('[iOS PWA] Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Log connection attempt details for debugging
 */
export function logConnectionAttempt(): void {
  if (typeof window === 'undefined') return;
  
  console.log('[iOS PWA] Connection attempt:', {
    isiOS,
    isStandalone,
    isiOSPWA,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    hasUserGesture: true // This function should only be called from user gesture
  });
}
