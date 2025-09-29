'use client';

import { Web3Modal } from '@web3modal/wagmi/react';
import { useConfig } from 'wagmi';

export default function Web3ModalBridge() {
  const config = useConfig(); // Same wagmi instance that Glyph created
  
  return (
    <Web3Modal
      wagmiConfig={config}
      projectId={process.env.NEXT_PUBLIC_WC_PROJECT_ID!}
      themeMode="dark"
      enableAnalytics={false}
      enableOnramp={false}
    />
  );
}
