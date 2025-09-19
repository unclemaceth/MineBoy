'use client';

import { http } from 'wagmi';
import type { Chain } from 'wagmi/chains';
import { mainnet, base, sepolia } from 'wagmi/chains';
import { defaultWagmiConfig, createWeb3Modal } from '@web3modal/wagmi/react';

// non-empty tuple of chains
export const chains = [mainnet, base, sepolia] as const satisfies readonly [Chain, ...Chain[]];

export const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID!;
const metadata = {
  name: 'MineBoy',
  description: 'MineBoy',
  // IMPORTANT: put your real public URL here (use your Vercel domain for now)
  url: 'https://mineboy-web-git-main-macs-projects-20ae48e1.vercel.app',
  icons: ['https://mineboy-web-git-main-macs-projects-20ae48e1.vercel.app/icon.png']
};

export const wagmiConfig = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [sepolia.id]: http()
  }
});

// guard against double init in HMR/Next
declare global { interface Window { __W3M_INIT__?: boolean } }

if (typeof window !== 'undefined' && !window.__W3M_INIT__) {
  window.__W3M_INIT__ = true;
  createWeb3Modal({
    wagmiConfig,
    projectId,
    themeMode: 'dark',
    enableAnalytics: false,
    enableOnramp: false
  });
}
