'use client';
import { useDisconnect } from 'wagmi';
import { useWalletStore } from '@/state/wallet';
import { useActiveAccount } from './useActiveAccount';
import { getAccount } from 'wagmi/actions';
import { wagmiConfig } from '@/lib/wallet';

export function useActiveDisconnect() {
  const { disconnect } = useDisconnect();
  const { provider } = useActiveAccount();

  const disconnectWallet = async () => {
    console.log('[useActiveDisconnect] Disconnecting, provider:', provider);
    
    try {
      // This calls the active connector's disconnect under wagmi (covers WalletConnect & Glyph)
      await disconnect();

      // Extra safety: if something held onto a connector, nuke it explicitly
      const acc = getAccount(wagmiConfig);
      if (acc?.connector?.disconnect) {
        try { 
          await acc.connector.disconnect?.(); 
        } catch (e) {
          console.warn('[useActiveDisconnect] Connector disconnect failed:', e);
        }
      }
    } catch (error) {
      console.error('[useActiveDisconnect] Disconnect error:', error);
    } finally {
      // Clear your external address so UI instantly reflects state
      useWalletStore.getState().setExternalAddress(null, null);
    }
  };

  return { disconnectWallet };
}
