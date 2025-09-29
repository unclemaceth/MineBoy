'use client';

import { createWeb3Modal } from '@web3modal/wagmi/react';
import { useConfig } from 'wagmi';
import { useEffect } from 'react';

export default function Web3ModalBridge() {
  const config = useConfig(); // Same wagmi instance that Glyph created
  
  useEffect(() => {
    // Initialize Web3Modal with the same config that Glyph created
    createWeb3Modal({
      wagmiConfig: config,
      projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!,
      themeMode: 'dark',
      enableAnalytics: false,
      enableOnramp: false
    });
  }, [config]);
  
  return null; // This component just initializes Web3Modal
}
