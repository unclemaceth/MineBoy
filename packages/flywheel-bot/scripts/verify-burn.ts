/**
 * Verify the burn transaction on-chain
 */
import { JsonRpcProvider, Contract, formatEther } from 'ethers';

const RPC_URL = process.env.RPC_URL || 'https://rpc.apechain.com/http';
const TREASURY = '0x0a8f8f3a13cB687A43ef33504A823Cf35e822874';
const MNESTR = '0xae0dfbb1a2b22080f947d1c0234c415fabeec276';
const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

async function main() {
  console.log('\n🔍 VERIFYING BURN TRANSACTION\n');
  
  const provider = new JsonRpcProvider(RPC_URL, 33139);
  const mnestr = new Contract(MNESTR, ERC20_ABI, provider);
  
  console.log('Treasury:', TREASURY);
  console.log('MNESTR:', MNESTR);
  console.log('Burn Address:', BURN_ADDRESS);
  console.log();
  
  // Check current burn balance
  const burnBalance = await mnestr.balanceOf(BURN_ADDRESS);
  console.log(`🔥 MNESTR Burned (current): ${formatEther(burnBalance)} MNESTR`);
  
  // Check total supply
  const totalSupply = await mnestr.totalSupply();
  console.log(`📊 Total Supply: ${formatEther(totalSupply)} MNESTR`);
  console.log();
  
  // Get recent blocks to find transfer events
  const currentBlock = await provider.getBlockNumber();
  console.log(`Current block: ${currentBlock}`);
  console.log('Searching last 1000 blocks for burn events...\n');
  
  const fromBlock = currentBlock - 1000;
  
  // Query Transfer events to burn address
  const filter = mnestr.filters.Transfer(null, BURN_ADDRESS);
  const events = await mnestr.queryFilter(filter, fromBlock, currentBlock);
  
  if (events.length === 0) {
    console.log('❌ No burn events found in last 1000 blocks');
    return;
  }
  
  console.log(`✅ Found ${events.length} burn event(s):\n`);
  
  for (const event of events) {
    const block = await event.getBlock();
    const tx = await event.getTransaction();
    
    console.log(`Block: ${event.blockNumber} (${new Date(block.timestamp * 1000).toISOString()})`);
    console.log(`From: ${event.args?.from}`);
    console.log(`Amount: ${formatEther(event.args?.value || 0n)} MNESTR 🔥`);
    console.log(`Tx: ${event.transactionHash}`);
    console.log(`Explorer: https://apescan.io/tx/${event.transactionHash}`);
    console.log();
  }
  
  // Check if treasury was the sender of the most recent burn
  if (events.length > 0) {
    const lastBurn = events[events.length - 1];
    const sender = lastBurn.args?.from?.toLowerCase();
    
    if (sender === TREASURY.toLowerCase()) {
      console.log('✅ CONFIRMED: Treasury successfully burned MNESTR!');
      console.log(`   Amount: ${formatEther(lastBurn.args?.value || 0n)} MNESTR 🔥`);
    } else {
      console.log(`ℹ️  Last burn was from: ${sender}`);
      console.log(`   (Treasury is: ${TREASURY.toLowerCase()})`);
    }
  }
}

main().catch(console.error);
