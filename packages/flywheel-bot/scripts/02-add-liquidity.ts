import 'dotenv/config';
import { Wallet, JsonRpcProvider, Contract, parseEther, parseUnits, formatEther, formatUnits } from 'ethers';

/**
 * Step 2: Add liquidity to Camelot DEX
 * 
 * This creates the MNESTR/APE pair on Camelot so the bot can swap APE → MNESTR.
 * Run this AFTER minting MNESTR to the LP wallet.
 */

const RPC = process.env.RPC_URL!;
const CHAIN_ID = Number(process.env.CHAIN_ID || 33139);
const DEX_ROUTER = process.env.DEX_ROUTER!;   // Camelot v2: 0x18E621...
const MNESTR = process.env.MNESTR!;
const LP_PK = process.env.LP_PRIVATE_KEY!;    // Key that holds MNESTR and APE

// ABIs
const ERC20 = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

const V2_ROUTER = [
  "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) payable returns (uint amountToken, uint amountETH, uint liquidity)"
];

async function main() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║   STEP 2: ADD LIQUIDITY TO CAMELOT        ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  const provider = new JsonRpcProvider(RPC, CHAIN_ID);
  const lp = new Wallet(LP_PK, provider);
  const me = await lp.getAddress();

  const mnestr = new Contract(MNESTR, ERC20, lp);
  const router = new Contract(DEX_ROUTER, V2_ROUTER, lp);

  const decimals: number = await mnestr.decimals();
  const mnestrBalance: bigint = await mnestr.balanceOf(me);
  const apeBalance: bigint = await provider.getBalance(me);

  console.log(`LP Wallet: ${me}`);
  console.log(`MNESTR Balance: ${formatUnits(mnestrBalance, decimals)} MNESTR`);
  console.log(`APE Balance: ${formatEther(apeBalance)} APE`);
  console.log(`DEX Router: ${DEX_ROUTER}\n`);

  // >>> SET YOUR LIQUIDITY TARGETS <<<
  // Example: Seed 10,000,000 MNESTR and 100 APE
  // This sets initial price at 0.00001 APE per MNESTR
  const mnestrToAddHuman = "10000000";  // 10 million MNESTR
  const apeToAddHuman = "100";          // 100 APE

  const amountTokenDesired = parseUnits(mnestrToAddHuman, decimals);
  const amountETHDesired = parseEther(apeToAddHuman);

  // Safety checks
  if (mnestrBalance < amountTokenDesired) {
    console.error(`❌ ERROR: Not enough MNESTR! Need ${mnestrToAddHuman}, have ${formatUnits(mnestrBalance, decimals)}`);
    console.log('Run: npm run script:mint first!');
    process.exit(1);
  }

  if (apeBalance < amountETHDesired) {
    console.error(`❌ ERROR: Not enough APE! Need ${apeToAddHuman}, have ${formatEther(apeBalance)}`);
    console.log('Send more APE to the LP wallet!');
    process.exit(1);
  }

  console.log(`📝 Preparing to add liquidity:`);
  console.log(`   MNESTR: ${mnestrToAddHuman}`);
  console.log(`   APE: ${apeToAddHuman}`);
  console.log(`   Initial Price: ${Number(apeToAddHuman) / Number(mnestrToAddHuman)} APE per MNESTR\n`);

  // Step 1: Approve router to spend MNESTR
  const currentAllowance: bigint = await mnestr.allowance(me, DEX_ROUTER);
  if (currentAllowance < amountTokenDesired) {
    console.log('Approving router to spend MNESTR...');
    const apTx = await mnestr.approve(DEX_ROUTER, amountTokenDesired);
    await apTx.wait();
    console.log('✅ Approval confirmed\n');
  } else {
    console.log('✅ Router already approved\n');
  }

  // Step 2: Add liquidity (97% slippage tolerance for first add)
  const amountTokenMin = amountTokenDesired * 97n / 100n;
  const amountETHMin = amountETHDesired * 97n / 100n;
  const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 min deadline

  console.log('Adding liquidity to Camelot...');
  const tx = await router.addLiquidityETH(
    MNESTR,
    amountTokenDesired,
    amountTokenMin,
    amountETHMin,
    me,
    deadline,
    { value: amountETHDesired }
  );

  console.log(`Transaction sent: ${tx.hash}`);
  const rc = await tx.wait();
  console.log(`✅ Liquidity added! Block: ${rc?.blockNumber}\n`);

  console.log('🎉 SUCCESS! The MNESTR/APE pool is now live on Camelot!');
  console.log('You will receive LP tokens in your LP wallet.');
  console.log('Consider locking or burning these LP tokens for trust.\n');
  
  console.log('✅ Step 2 Complete! The bot can now swap APE → MNESTR → Burn! 🔥\n');
}

main().catch((e) => { 
  console.error('❌ Error:', e); 
  process.exit(1); 
});
