'use client';

import { useState } from 'react';
import { useActiveAccount } from './useActiveAccount';

export function useBackendMint() {
  const { address, isConnected } = useActiveAccount();
  const [isMinting, setIsMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mint(): Promise<{ txHash: string }> {
    if (!isConnected || !address) {
      throw new Error('Connect your wallet');
    }

    setIsMinting(true);
    setError(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/v2/mint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wallet: address
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Minting failed');
      }

      if (!data.success) {
        throw new Error(data.error || 'Minting failed');
      }

      return { txHash: data.txHash };
    } catch (err: any) {
      const errorMessage = err.message || 'Minting failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsMinting(false);
    }
  }

  return {
    mint,
    isMinting,
    error,
    isReady: isConnected && !!address
  };
}
