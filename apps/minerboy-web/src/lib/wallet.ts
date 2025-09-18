'use client';

import { http, createConfig } from 'wagmi';
import { mainnet, base, sepolia } from 'wagmi/chains';
import { apeChain, curtis } from 'viem/chains';
import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';

export const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id';

const chains = [apeChain, mainnet, base, curtis, sepolia];

const metadata = {
  name: 'MineBoy',
  description: 'MineBoy miner',
  url: 'https://minerboy.app',
  icons: ['https://minerboy.app/icon.png']
};

// wagmi config
export const wagmiConfig = createConfig({
  chains,
  transports: {
    [apeChain.id]: http(),
    [mainnet.id]: http(),
    [base.id]: http(),
    [curtis.id]: http(),
    [sepolia.id]: http()
  }
});

// Create AppKit (formerly Web3Modal)
export const appKit = createAppKit({
  adapters: [WagmiAdapter(wagmiConfig)],
  projectId,
  defaultChain: apeChain,
  metadata,
  features: {
    analytics: false, // Optional - defaults to your Cloud configuration
    email: false, // Optional - defaults to true
    socials: [] // Optional - defaults to your Cloud configuration
  }
});
