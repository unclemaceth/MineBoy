import 'dotenv/config';

/**
 * Bot configuration
 * All addresses and settings loaded from environment variables
 */
export const cfg = {
  // Blockchain connection
  rpcUrl: process.env.RPC_URL!,
  chainId: Number(process.env.CHAIN_ID || 33139),

  // Contract addresses
  mnestr: process.env.MNESTR!,           // MNESTR token (burnable)
  npc: process.env.NPC_COLLECTION!,       // NPC NFT collection

  marketRouter: process.env.MARKET_ROUTER!, // Router for buying NFTs
  
  dexRouter: process.env.DEX_ROUTER!,     // Camelot v2 for swaps
  wape: process.env.WAPE!,                // Wrapped APE token

  // Flywheel wallet (bot's wallet)
  flywheelAddr: process.env.FLYWHEEL_WALLET!,
  flywheelPk: process.env.FLYWHEEL_PRIVATE_KEY!,

  // Policy knobs
  knobs: {
    markupBps: Number(process.env.MARKUP_BPS || 2000),        // +20% relist
    buyBufferBps: Number(process.env.BUY_BUFFER_BPS || 100),  // 1% buffer
    dailySpendCapApe: Number(process.env.DAILY_SPEND_CAP_APE || 250) // 250 APE/day max
  }
};
