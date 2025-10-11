'use client';

import { http } from 'wagmi';
import type { Chain } from 'wagmi/chains';
import { mainnet, base, arbitrum, optimism, polygon } from 'wagmi/chains';
import { defaultWagmiConfig } from '@web3modal/wagmi/react';

// -- Chains
export const apechain = {
  id: 33139,
  name: 'ApeChain',
  nativeCurrency: { name: 'ApeCoin', symbol: 'APE', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.apechain.com/http'] } },
  blockExplorers: { default: { name: 'ApeScan', url: 'https://apescan.io' } }
} as const satisfies Chain;

export const curtis = {
  id: 33111,
  name: 'Curtis',
  nativeCurrency: { name: 'ApeCoin', symbol: 'APE', decimals: 18 },
  rpcUrls: { default: { http: ['https://curtis.rpc.caldera.xyz/http'] } },
  blockExplorers: { default: { name: 'Curtis Explorer', url: 'https://curtis.explorer.caldera.xyz' } }
} as const satisfies Chain;

export const chains = [apechain, base, mainnet, arbitrum, optimism, polygon, curtis] as const;

// -- Prevent wagmi autoConnect without losing Web3Modal wallet catalog
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
} as const;

// -- Your metadata for wallet UIs
const getSiteUrl = () => (typeof window !== 'undefined' ? window.location.origin : 'https://mineboy.app');

export const wagmiConfig = defaultWagmiConfig({
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!, // required
  chains,
  metadata: {
    name: 'MineBoy™',
    description: 'MineBoy™',
    url: getSiteUrl(),
    icons: [`${getSiteUrl()}/icon.png`]
  },
  ssr: true,
  // 👇 disables wagmi's persisted cache → stops eager autoConnect flicker
  storage: noopStorage,
  // Override transports explicitly for custom RPC endpoints
  transports: {
    [apechain.id]: http('https://rpc.apechain.com/http'),
    [base.id]: http(),
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [polygon.id]: http(),
    [curtis.id]: http('https://curtis.rpc.caldera.xyz/http')
  }
});