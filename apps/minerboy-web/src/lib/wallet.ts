'use client';

import { http, createConfig } from 'wagmi';
import type { Chain } from 'wagmi/chains';
import { mainnet, base, arbitrum, optimism, polygon } from 'wagmi/chains';
import { walletConnect, injected } from 'wagmi/connectors';

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

// Single wagmi config used everywhere (no autoConnect to prevent flicker)
export const wagmiConfig = createConfig({
  chains,
  connectors: [
    walletConnect({
      projectId,
      showQrModal: false, // Web3Modal handles UI
      metadata: {
        name: 'MineBoy™',
        description: 'MineBoy™',
        url: getSiteUrl(),
        icons: [`${getSiteUrl()}/icon.png`]
      }
    }),
    injected({ shimDisconnect: true })
  ],
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
  // @ts-expect-error wagmi accepts this; prevents race/flicker
  autoConnect: false
});