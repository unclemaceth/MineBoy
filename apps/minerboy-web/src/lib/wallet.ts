'use client';

import { http } from 'wagmi';
import type { Chain } from 'wagmi/chains';
import { defaultWagmiConfig, createWeb3Modal } from '@web3modal/wagmi/react';

export const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || '';
export const w3mReady = !!projectId;

// Use dynamic siteUrl to match current origin (fixes Vercel preview warnings)
const getSiteUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://mineboy.app';
};

export const curtis = {
  id: 33111,
  name: 'Curtis',
  nativeCurrency: { name: 'ApeCoin', symbol: 'APE', decimals: 18 },
  rpcUrls: { default: { http: ['https://curtis.rpc.caldera.xyz/http'] } },
  blockExplorers: { default: { name: 'Curtis Explorer', url: 'https://curtis.explorer.caldera.xyz' } }
} as const satisfies Chain;

export const apechain = {
  id: 33139,
  name: 'ApeChain',
  nativeCurrency: { name: 'ApeCoin', symbol: 'APE', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.apechain.com/http'] } },
  blockExplorers: { default: { name: 'ApeScan', url: 'https://apescan.io' } }
} as const satisfies Chain;

export const chains = [apechain, curtis] as const;

// Single wagmi config used everywhere
export const wagmiConfig = defaultWagmiConfig({
  chains,
  projectId,
  metadata: {
    name: 'MineBoy™',
    description: 'MineBoy™',
    url: getSiteUrl(),
    icons: [`${getSiteUrl()}/icon.png`]
  },
  transports: {
    [apechain.id]: http('https://rpc.apechain.com/http'),
    [curtis.id]: http('https://curtis.rpc.caldera.xyz/http')
  }
});

// Web3Modal is now initialized in the Providers component
// This ensures it's available before any components try to use useWeb3Modal