import { http, createConfig } from 'wagmi';
import { defineChain } from 'viem';
import { injected, walletConnect } from 'wagmi/connectors';

// Curtis testnet configuration
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

// Wagmi configuration
export const config = createConfig({
  chains: [curtis],
  connectors: [
    injected(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
    }),
  ],
  transports: {
    [curtis.id]: http(),
  },
});

// Contract addresses (will be set after deployment)
export const contracts = {
  apeBitToken: process.env.NEXT_PUBLIC_APEBIT_TOKEN_ADDRESS as `0x${string}`,
  miningClaimRouter: process.env.NEXT_PUBLIC_MINING_CLAIM_ROUTER_ADDRESS as `0x${string}`,
  apeBitCartridge: process.env.NEXT_PUBLIC_APEBIT_CARTRIDGE_ADDRESS as `0x${string}`,
} as const;

// Backend API base URL
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8787';

// ABI definitions
export const APEBIT_TOKEN_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
] as const;

export const MINING_CLAIM_ROUTER_ABI = [
  'function claim((address wallet, address cartridge, uint256 tokenId, address rewardToken, uint256 rewardAmount, bytes32 workHash, uint64 attempts, bytes32 nonce, uint64 expiry) claimData, bytes signature)',
  'function allowedCartridge(address) view returns (bool)',
  'function signer() view returns (address)',
] as const;

export const APEBIT_CARTRIDGE_ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function mint(address to) payable',
  'function mintPrice() view returns (uint256)',
] as const;
