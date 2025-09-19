'use client';

import { http } from 'wagmi';
import type { Chain } from 'wagmi/chains';
import { mainnet, base, sepolia } from 'wagmi/chains';
import { defineChain } from 'viem';

// Curtis testnet
export const curtis = defineChain({
  id: 33111,
  name: 'Curtis',
  nativeCurrency: {
    decimals: 18,
    name: 'APE',
    symbol: 'APE',
  },
  rpcUrls: {
    default: {
      http: ['https://curtis.rpc.caldera.xyz/http'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Curtis Explorer',
      url: 'https://curtis.explorer.caldera.xyz',
    },
  },
  testnet: true,
});

// ApeChain mainnet
export const apeChain = defineChain({
  id: 33133,
  name: 'ApeChain',
  nativeCurrency: {
    decimals: 18,
    name: 'ApeCoin',
    symbol: 'APE',
  },
  rpcUrls: {
    default: {
      http: ['https://apechain.rpc.thirdweb.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'ApeChain Explorer',
      url: 'https://apechain.explorer.thirdweb.com',
    },
  },
  testnet: false,
});
import { defaultWagmiConfig, createWeb3Modal } from '@web3modal/wagmi/react';

export const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || '';
export const w3mReady = !!projectId;

const siteUrl = 'https://mineboy.app';

export const chains = [mainnet, base, sepolia, curtis, apeChain] as const satisfies readonly [Chain, ...Chain[]];

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
    [mainnet.id]: http(),
    [base.id]: http(),
    [sepolia.id]: http(),
    [curtis.id]: http(),
    [apeChain.id]: http()
  }
});

declare global { interface Window { __W3M_INIT__?: boolean } }

if (typeof window !== 'undefined') {
  if (!w3mReady) {
    console.warn('[MineBoy] NEXT_PUBLIC_WC_PROJECT_ID missing – Web3Modal disabled');
  } else if (!window.__W3M_INIT__) {
    window.__W3M_INIT__ = true;
    createWeb3Modal({
      wagmiConfig,
      projectId,
      themeMode: 'dark',
      enableAnalytics: false,
      enableOnramp: false
    });
  }
}
