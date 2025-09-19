'use client';

import { http } from 'wagmi';
import type { Chain } from 'wagmi/chains';
import { mainnet, base, sepolia } from 'wagmi/chains';
import { defaultWagmiConfig, createWeb3Modal } from '@web3modal/wagmi/react';

// --------------- REQUIRED: valid project id ---------------
export const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? '';
if (typeof window !== 'undefined' && !projectId) {
  // Fail loudly so we don't end up with "buttons do nothing"
  throw new Error('NEXT_PUBLIC_WC_PROJECT_ID is missing');
}

// --------------- Chains ---------------
export const chains = [mainnet, base, sepolia] as const satisfies readonly [
  Chain, ...Chain[]
];

// --------------- Metadata (use your public URL) ---------------
const siteUrl = 'https://mineboy-web-git-main-macs-projects-20ae48e1.vercel.app';

const metadata = {
  name: 'MineBoy',
  description: 'MineBoy',
  url: siteUrl,
  icons: [`${siteUrl}/icon.png`]
};

// --------------- wagmi config ---------------
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

// --------------- Init Web3Modal once ---------------
declare global { interface Window { __W3M_INIT__?: boolean } }

if (typeof window !== 'undefined' && !window.__W3M_INIT__) {
  window.__W3M_INIT__ = true;
  console.log('[MineBoy] WC projectId:', projectId); // sanity check
  createWeb3Modal({
    wagmiConfig,
    projectId,
    themeMode: 'dark',
    enableAnalytics: false,
    enableOnramp: false
  });
}
