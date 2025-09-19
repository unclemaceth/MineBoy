'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';

/**
 * GlyphBridge component to handle Glyph wallet integration.
 * Bridges the Web3Modal provider to Glyph so they share the same connection state.
 */
export default function GlyphBridge() {
  const { isConnected, connector } = useAccount();
  const [provider, setProvider] = useState<any>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isConnected || !connector) {
        setProvider(undefined);
        return;
      }
      
      try {
        // Get the real EIP-1193 provider from the active wagmi connector
        const prov = await connector.getProvider();
        if (!cancelled) {
          setProvider(prov);
          console.log('GlyphBridge: Got provider from connector', { 
            isConnected, 
            connectorName: connector.name,
            hasProvider: !!prov
          });
        }
      } catch (error) {
        console.error('GlyphBridge: Failed to get provider from connector', error);
        if (!cancelled) setProvider(undefined);
      }
    })();
    return () => { cancelled = true; };
  }, [isConnected, connector]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Set global flags that Glyph can use to know a wallet is connected
      (window as any).__GLYPH_WALLET_CONNECTED__ = {
        address: isConnected ? (window as any).ethereum?.selectedAddress : undefined,
        isConnected,
        provider
      };

      console.log('GlyphBridge: Updated wallet state', { 
        isConnected, 
        hasProvider: !!provider,
        connectorName: connector?.name
      });
    }
  }, [isConnected, provider, connector]);

  return null;
}