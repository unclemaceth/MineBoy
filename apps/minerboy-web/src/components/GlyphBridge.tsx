'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';

/**
 * GlyphBridge component to bridge the real EIP-1193 provider to Glyph.
 * This is why Glyph was showing { address: undefined } - it wasn't getting the real provider.
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
        // This is the crucial fix - Glyph needs the actual provider, not window.ethereum
        const prov = await connector.getProvider();
        if (!cancelled) {
          setProvider(prov);
          console.log('GlyphBridge: Got provider from connector', {
            isConnected,
            connectorName: connector.name,
            hasProvider: !!prov,
            providerType: prov?.constructor?.name
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
      // Set global flags that Glyph can use
      (window as any).__GLYPH_WALLET_CONNECTED__ = {
        address: isConnected ? (window as any).ethereum?.selectedAddress : undefined,
        isConnected,
        provider
      };

      console.log('GlyphBridge: Updated wallet state', {
        isConnected,
        hasProvider: !!provider,
        connectorName: connector?.name,
        providerAvailable: !!provider
      });
    }
  }, [isConnected, provider, connector]);

  // TODO: Once we have the correct Glyph SDK API, wire the provider here
  // Example: return <GlyphProvider provider={provider} />;
  // Or: return <GlyphWidget strategy={provider ? new EIP1193Strategy({ provider }) : undefined} />;
  
  return null;
}