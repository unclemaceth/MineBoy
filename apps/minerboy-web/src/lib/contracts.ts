import { parseAbi } from 'viem';

export const APEBIT_CARTRIDGE_ABI = parseAbi([
  'function mintPrice() view returns (uint256)',
  'function mint(address to) payable',
  'function totalSupply() view returns (uint256)',
  'function maxSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
] as const);

// Legacy export for compatibility
export const CARTRIDGE_ABI = APEBIT_CARTRIDGE_ABI;

// Real deployed addresses from Curtis deployment
export const CONTRACTS: Record<number, { cartridge: `0x${string}` }> = {
  33133: { cartridge: '0x1234567890123456789012345678901234567890' }, // ApeChain - not deployed yet
  33111: { cartridge: '0xb05fa76709b6bd18c63782e9044ff81430f6769c' }  // Curtis - actual deployed cartridge address
};

// Additional exports for compatibility with existing code
export const CARTRIDGE_ADDRESSES: Record<number, `0x${string}`> = {
  33133: '0x1234567890123456789012345678901234567890', // ApeChain - not deployed yet
  33111: '0xb05fa76709b6bd18c63782e9044ff81430f6769c'  // Curtis - actual deployed cartridge address
};
export const CARTRIDGE_ADDRESS = '0xb05fa76709b6bd18c63782e9044ff81430f6769c'; // Curtis cartridge address
export const CURTIS_CHAIN_ID = 33111;
export const APECHAIN_CHAIN_ID = 33133;
export const EXPLORER_BASE = 'https://curtis.explorer.caldera.xyz';
export const APECHAIN_EXPLORER_BASE = 'https://apescan.io';

export const MINING_CLAIM_ROUTER_ABI = parseAbi([
  'function claimRewards(uint256[] memory tokenIds) external',
  'function getClaimableRewards(address user, uint256[] memory tokenIds) view returns (uint256)'
]);

export const contracts = {
  miningClaimRouter: '0x5883d7a4a1b503ced7c799baf3d677a23093e564'
};