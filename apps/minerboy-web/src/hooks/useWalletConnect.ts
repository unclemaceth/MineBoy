import { useEffect } from 'react';
import { useConnect } from 'wagmi';
import { walletConnect } from 'wagmi/connectors';

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
      window.dispatchEvent(new CustomEvent('walletconnect_display_uri', {
        detail: { uri }
      }));
    };

    // Set up WalletConnect event listeners
    const setupWalletConnect = async () => {
      try {
        // Create a temporary connector to set up event listeners
        const connector = walletConnect({
          projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
        });

        // Listen for display_uri events
        connector.on('display_uri', handleDisplayUri);

        return () => {
          connector.off('display_uri', handleDisplayUri);
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
