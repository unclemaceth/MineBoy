'use client';

import { useEffect } from 'react';
import { useAccount } from 'wagmi';

/**
 * GlyphBridge component to handle Glyph wallet integration.
 * Sets up Glyph to use the connected wallet from Wagmi.
 */
export default function GlyphBridge() {
  const { isConnected, address } = useAccount();

  useEffect(() => {
    if (!isConnected || !address) return;

    // Set up Glyph to use the connected wallet
    // This tells Glyph to use the wallet that's already connected via Wagmi
    if (typeof window !== 'undefined') {
      // Set a global flag that Glyph can use to know a wallet is connected
      (window as any).__GLYPH_WALLET_CONNECTED__ = {
        address,
        isConnected: true
      };
    }
  }, [isConnected, address]);

  return null;
}