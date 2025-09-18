'use client';

import { http } from 'wagmi'
import type { Chain } from 'wagmi/chains'
import { mainnet, base, sepolia } from 'wagmi/chains'
import { defaultWagmiConfig, createWeb3Modal } from '@web3modal/wagmi/react'
import { defineChain } from 'viem'

// Custom EVM chains
export const apeChain = defineChain({
  id: 31337,
  name: 'ApeChain',
  nativeCurrency: { name: 'APE', symbol: 'APE', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.apechain.example'] } },
  blockExplorers: {
    default: { name: 'Apescan', url: 'https://apescan.io' }
  }
}) satisfies Chain

export const curtis = defineChain({
  id: 696969,
  name: 'Curtis',
  nativeCurrency: { name: 'CURT', symbol: 'CURT', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.curtis.example'] } },
  blockExplorers: {
    default: { name: 'Curtis Explorer', url: 'https://explorer.curtis.example' }
  }
}) satisfies Chain

// IMPORTANT: this must be a non-empty tuple ("as const" keeps the tuple type)
export const chains = [apeChain, mainnet, base, curtis, sepolia] as const satisfies readonly [Chain, ...Chain[]]

export const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || 'demo-project-id'

export const wagmiConfig = defaultWagmiConfig({
  chains,
  projectId,
  metadata: {
    name: 'MineBoy',
    description: 'MineBoy miner',
    url: 'https://minerboy.app',
    icons: ['https://minerboy.app/icon.png']
  },
  transports: {
    [apeChain.id]: http(),
    [mainnet.id]: http(),
    [base.id]: http(),
    [curtis.id]: http(),
    [sepolia.id]: http()
  }
})

// Init the modal on the client once
if (typeof window !== 'undefined') {
  createWeb3Modal({
    wagmiConfig,
    projectId,
    themeMode: 'dark',
    enableAnalytics: false,
    enableOnramp: false
  })
}
