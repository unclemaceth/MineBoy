'use client';

import { http } from 'wagmi';
import type { Chain } from 'wagmi/chains';
import { mainnet, base, sepolia } from 'wagmi/chains';
import { defaultWagmiConfig, createWeb3Modal } from '@web3modal/wagmi/react';

export const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || '';
export const w3mReady = !!projectId;

// dynamic to avoid metadata mismatch warnings on prod vs preview
const siteUrl =
  typeof window !== 'undefined' ? window.location.origin : 'https://mineboy.app';

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
  blockExplorers: { default: { name: 'ApeScan', url: 'https://apechain.explorer.thirdweb.com' } }
} as const satisfies Chain;

export const chains = [mainnet, base, sepolia, curtis, apechain] as const;

const metadata = {
  name: 'MineBoy',
  description: 'MineBoy',
  url: siteUrl,
  icons: [`${siteUrl}/icon.png`]
};

export const wagmiConfig = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
  transports: {
    [mainnet.id]:  http(),
    [base.id]:     http(),
    [sepolia.id]:  http(),
    [curtis.id]:   http('https://curtis.rpc.caldera.xyz/http'),
    [apechain.id]: http('https://apechain.rpc.thirdweb.com')
  },
  // localStorage persistence (already default, but explicit doesn't hurt)
  // storage: typeof window !== 'undefined' ? window.localStorage : null
});

declare global { interface Window { __W3M_INIT__?: boolean } }

if (typeof window !== 'undefined') {
  if (!w3mReady) {
    console.warn('[MineBoy] NEXT_PUBLIC_WC_PROJECT_ID missing – Web3Modal disabled');
  } else if (!window.__W3M_INIT__) {
    window.__W3M_INIT__ = true;
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