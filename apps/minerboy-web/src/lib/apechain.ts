import { defineChain, createPublicClient, http } from 'viem';

export const apechain = defineChain({
  id: 33139,
  name: 'ApeChain',
  nativeCurrency: { name: 'ApeCoin', symbol: 'APE', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.apechain.com'] },
    public: { http: ['https://rpc.apechain.com'] },
  },
  blockExplorers: {
    default: {
      name: 'ApeChain Explorer',
      url: 'https://apescan.io',
    },
  },
});

// Singleton public client for ApeChain balance checks
export const apePublicClient = createPublicClient({
  chain: apechain,
  transport: http(),
});

