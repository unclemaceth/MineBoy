'use client';

import { useEffect } from 'react';
import { useAccount } from 'wagmi';

/**
 * GlyphBridge component to handle Glyph wallet integration.
 * Bridges the Web3Modal provider to Glyph so they share the same connection state.
 */
export default function GlyphBridge() {
  const { isConnected, address } = useAccount();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Set global flags that Glyph can use to know a wallet is connected
      (window as any).__GLYPH_WALLET_CONNECTED__ = {
        address,
        isConnected
      };

      console.log('GlyphBridge: Updated wallet state', { 
        isConnected, 
        address: address?.slice(0, 8) + '...' + address?.slice(-6)
      });
    }
  }, [isConnected, address]);

  return null;
}