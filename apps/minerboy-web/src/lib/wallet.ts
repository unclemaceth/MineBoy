'use client';

import { http, createStorage } from 'wagmi';
import type { Chain } from 'wagmi/chains';
import { mainnet, base, arbitrum, optimism, polygon } from 'wagmi/chains';
import { defaultWagmiConfig } from '@web3modal/wagmi/react';

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

// Include major bridging chains for Relay swap functionality
export const chains = [apechain, base, mainnet, arbitrum, optimism, polygon, curtis] as const;

// Custom storage to prevent autoConnect flicker
const noopStorage = createStorage({
  storage: {
    async getItem() { return null; },
    async setItem() {},
    async removeItem() {}
  }
});

// Use defaultWagmiConfig for Web3Modal wallet discovery, but disable autoConnect
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
    [base.id]: http(),
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [polygon.id]: http(),
    [curtis.id]: http('https://curtis.rpc.caldera.xyz/http')
  },
  ssr: true,
  // Use noop storage to prevent autoConnect while keeping wallet discovery
  storage: noopStorage
});