import { useEffect } from 'react';
import { useConnect } from 'wagmi';
import { walletConnect } from 'wagmi/connectors';
import type { EthereumProvider } from '@walletconnect/ethereum-provider';

/**
 * Hook to handle WalletConnect events and deep linking
 */
export function useWalletConnect() {
  const { connect } = useConnect();

  useEffect(() => {
    // Listen for WalletConnect display_uri events
    const handleDisplayUri = (uri: string) => {
      console.log('[WalletConnect] Display URI received:', uri.length, 'chars');
      
      // Dispatch custom event for the modal to listen to
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('walletconnect_display_uri', {
          detail: { uri }
        }));
      }
    };

    // Set up WalletConnect event listeners
    const setupWalletConnect = async () => {
      try {
        // Create a temporary connector to set up event listeners
        const connector = walletConnect({
          projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
        });

        // Get the provider to listen for events
        const provider = (await connector.getProvider()) as EthereumProvider;
        
        // Listen for display_uri events on the provider
        const wrapped = (uri: string) => handleDisplayUri(uri);
        (provider.on ?? provider.addListener).call(provider, 'display_uri', wrapped);

        return () => {
          (provider.off ?? provider.removeListener)?.call(provider, 'display_uri', wrapped);
        };
      } catch (error) {
        console.warn('[WalletConnect] Failed to set up event listeners:', error);
        return () => {};
      }
    };

    const cleanup = setupWalletConnect();

    return () => {
      cleanup.then(cleanupFn => cleanupFn());
    };
  }, [connect]);

  return {
    connectWalletConnect: () => connect({ connector: walletConnect() })
  };
}
