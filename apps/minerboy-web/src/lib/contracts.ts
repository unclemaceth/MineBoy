import { parseAbi } from 'viem';

export const APEBIT_CARTRIDGE_ABI = parseAbi([
  'function mintPrice() view returns (uint256)',
  'function mint(address to) payable',
  'function totalSupply() view returns (uint256)',
  'function maxSupply() view returns (uint256)',
  'function maxPerWallet() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
] as const);

// Legacy export for compatibility
export const CARTRIDGE_ABI = APEBIT_CARTRIDGE_ABI;

// Real deployed addresses from Curtis deployment
export const CONTRACTS: Record<number, { cartridge: `0x${string}` }> = {
  33139: { cartridge: '0xCA2D7B429248A38b276c8293506f3bE8E1FC2C2d' }, // ApeChain - new secure contract
  33111: { cartridge: '0xb05fa76709b6bd18c63782e9044ff81430f6769c' }  // Curtis - actual deployed cartridge address
};

// Additional exports for compatibility with existing code
export const CARTRIDGE_ADDRESSES: Record<number, `0x${string}`> = {
  33139: '0x3322b37349AeFD6F50F7909B641f2177c1D34D25', // ApeChain - Pickaxes (V3)
  33111: '0xb05fa76709b6bd18c63782e9044ff81430f6769c'  // Curtis - actual deployed cartridge address
};
export const CARTRIDGE_ADDRESS = '0xb05fa76709b6bd18c63782e9044ff81430f6769c'; // Curtis cartridge address
export const CURTIS_CHAIN_ID = 33111;
export const APECHAIN_CHAIN_ID = 33139;
export const EXPLORER_BASE = 'https://curtis.explorer.caldera.xyz';
export const APECHAIN_EXPLORER_BASE = 'https://apescan.io';

export const MINING_CLAIM_ROUTER_ABI = parseAbi([
  'function claimRewards(uint256[] memory tokenIds) external',
  'function getClaimableRewards(address user, uint256[] memory tokenIds) view returns (uint256)'
]);

export const contracts = {
  miningClaimRouter: '0xf808fC0a027e8F61C24580dda1A43afe3c088354' // V3 Router
};