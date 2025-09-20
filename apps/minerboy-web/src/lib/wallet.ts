'use client';

import { http } from 'wagmi';
import type { Chain } from 'wagmi/chains';
import { mainnet } from 'wagmi/chains';
import { defaultWagmiConfig, createWeb3Modal } from '@web3modal/wagmi/react';

export const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || '';
export const w3mReady = !!projectId;

// Use static siteUrl to stop metadata mismatch warning
const siteUrl = 'https://mineboy.app';

export const curtis = {
  id: 33111,
  name: 'Curtis',
  nativeCurrency: { name: 'ApeCoin', symbol: 'APE', decimals: 18 },
  rpcUrls: { default: { http: ['https://curtis.rpc.caldera.xyz/http'] } },
  blockExplorers: { default: { name: 'Curtis Explorer', url: 'https://curtis.explorer.caldera.xyz' } }
} as const satisfies Chain;

export const apechain = {
  id: 33133,
  name: 'ApeChain',
  nativeCurrency: { name: 'ApeCoin', symbol: 'APE', decimals: 18 },
  rpcUrls: { default: { http: ['https://apechain.rpc.thirdweb.com'] } },
  blockExplorers: { default: { name: 'ApeScan', url: 'https://apescan.io' } }
} as const satisfies Chain;

export const chains = [mainnet, apechain, curtis] as const;

// Single wagmi config used everywhere
export const wagmiConfig = defaultWagmiConfig({
  chains,
  projectId,
  metadata: {
    name: 'MineBoy',
    description: 'MineBoy',
    url: siteUrl,
    icons: [`${siteUrl}/icon.png`]
  },
  transports: {
    [mainnet.id]: http(),
    [apechain.id]: http('https://apechain.rpc.thirdweb.com'),
    [curtis.id]: http('https://curtis.rpc.caldera.xyz/http')
  }
});

// Initialize Web3Modal with the same config (only once)
declare global { interface Window { __W3M__?: boolean } }

if (typeof window !== 'undefined') {
  if (!w3mReady) {
    console.warn('[MineBoy] NEXT_PUBLIC_WC_PROJECT_ID missing – Web3Modal disabled');
  } else if (!window.__W3M__) {
    window.__W3M__ = true;
    console.log('[MineBoy] Initializing Web3Modal with projectId:', projectId);
    createWeb3Modal({
      wagmiConfig,
      projectId,
      themeMode: 'dark',
      enableAnalytics: false,
      enableOnramp: false
    });
    console.log('[MineBoy] Web3Modal initialized successfully');
  } else {
    console.log('[MineBoy] Web3Modal already initialized');
  }
}