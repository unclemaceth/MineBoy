import 'dotenv/config';
import { Wallet, JsonRpcProvider, Contract, parseUnits, formatUnits } from 'ethers';

/**
 * Step 1: Mint MNESTR for liquidity pool
 * 
 * This script mints MNESTR tokens to the LP wallet so we can create a pool.
 * You only need to run this ONCE to bootstrap the system.
 */

const RPC = process.env.RPC_URL!;
const CHAIN_ID = Number(process.env.CHAIN_ID || 33139);
const MNESTR = process.env.MNESTR!;
const ADMIN_PK = process.env.ADMIN_PRIVATE_KEY!;  // Whoever has minting rights
const LP_WALLET = process.env.LP_WALLET || '0xB8bb2C7fDE8FfB6fe2B71d401E5DD2612Fc6A043';

// Minimal MNESTR ABI
const MNESTR_ABI = [
  "function mint(address to, uint256 amount) external",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function cap() view returns (uint256)"
];

async function main() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║   STEP 1: MINT MNESTR FOR LP              ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  const provider = new JsonRpcProvider(RPC, CHAIN_ID);
  const admin = new Wallet(ADMIN_PK, provider);
  const mnestr = new Contract(MNESTR, MNESTR_ABI, admin);

  const decimals: number = await mnestr.decimals();
  const totalSupply: bigint = await mnestr.totalSupply();
  const cap: bigint = await mnestr.cap();
  
  console.log(`MNESTR Token: ${MNESTR}`);
  console.log(`Current Supply: ${formatUnits(totalSupply, decimals)} MNESTR`);
  console.log(`Cap: ${formatUnits(cap, decimals)} MNESTR`);
  console.log(`Admin: ${await admin.getAddress()}`);
  console.log(`LP Wallet: ${LP_WALLET}\n`);

  // >>> DECIDE YOUR MINT AMOUNT <<<
  // Recommendation: Start with 10,000,000 MNESTR (1% of 1B cap)
  const amountHuman = "10000000"; // 10 million
  const amount = parseUnits(amountHuman, decimals);

  // Safety check
  if (totalSupply + amount > cap) {
    console.error(`❌ ERROR: Minting ${amountHuman} would exceed cap!`);
    process.exit(1);
  }

  console.log(`📝 Preparing to mint: ${amountHuman} MNESTR`);
  console.log(`   To: ${LP_WALLET}`);
  console.log(`   This will use ~1% of the 1B cap\n`);

  console.log('Minting...');
  const tx = await mnestr.mint(LP_WALLET, amount);
  console.log(`Transaction sent: ${tx.hash}`);
  
  const rc = await tx.wait();
  console.log(`✅ Minted successfully! Block: ${rc?.blockNumber}\n`);

  // Verify
  const newBalance: bigint = await mnestr.balanceOf(LP_WALLET);
  console.log(`LP Wallet now has: ${formatUnits(newBalance, decimals)} MNESTR`);
  
  console.log('\n✅ Step 1 Complete! Now run: npm run script:add-liquidity\n');
}

main().catch((e) => { 
  console.error('❌ Error:', e); 
  process.exit(1); 
});
