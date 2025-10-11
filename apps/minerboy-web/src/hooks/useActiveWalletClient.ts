'use client';
import { useEffect, useState } from 'react';
import { useWalletClient, useConnectorClient } from 'wagmi';
import { createWalletClient, custom } from 'viem';
import { apechain } from '@/lib/wallet';
import { useActiveAccount } from './useActiveAccount';

export function useActiveWalletClient() {
  const { data: wagmiWalletClient } = useWalletClient();
  const { data: connectorClient } = useConnectorClient();
  const { provider } = useActiveAccount();
  const [client, setClient] = useState<any>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (provider === 'glyph') {
        setClient(wagmiWalletClient ?? null);
        return;
      }

      if (provider === 'wc') {
        // For WalletConnect, use the connector client or try to get provider from connector
        if (connectorClient) {
          setClient(connectorClient);
          return;
        }
        // Fallback: try window.ethereum as a last resort (WalletConnect may inject here)
        if (typeof window !== 'undefined' && (window as any).ethereum) {
          const wcClient = createWalletClient({
            chain: apechain,
            transport: custom((window as any).ethereum)
          });
          if (mounted) setClient(wcClient);
          return;
        }
      }

      if (mounted) setClient(null);
    })();

    return () => { mounted = false; };
  }, [provider, connectorClient, wagmiWalletClient]);

  return client;
}
