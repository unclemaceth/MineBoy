/**
 * Treasury Burn Service
 * 
 * Receives sale proceeds from NPC sales and:
 * 1. Swaps 99% APE → MNESTR via Camelot DEX
 * 2. Burns the MNESTR to 0xdead
 * 3. Sends 1% APE to trading wallet for gas
 */

import { parseEther, formatEther, Contract } from 'ethers';
import { treasury } from '../wallets.js';
import { cfg } from '../config.js';
import { alertSuccess, alertErrorDeduped } from '../utils/discord.js';
import { recordBurn, recordSwapFailure } from '../utils/health.js';
import { recordDailyBurn, recordDailyGas, recordDailyFailure } from '../utils/dailySummary.js';

const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';

// YakRouter ABI (token-in variant - swapNoSplit, NOT swapNoSplitFromETH)
const YAK_ROUTER_ABI = [
  "function swapNoSplit((uint256 amountIn,uint256 amountOut,address[] path,address[] adapters),uint256 fee,address to) payable returns (uint256)"
];

// Camelot Router ABI for querying rates
const CAMELOT_ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)"
];

// WAPE ABI for wrapping
const WAPE_ABI = [
  'function deposit() payable',
  'function approve(address spender, uint256 amount) returns (bool)'
];

const ERC20_ABI = [
  'function transfer(address to, uint amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

/**
 * Security Fix #5: Gas price caps to prevent excessive fees
 * Returns { maxFeePerGas, maxPriorityFeePerGas } in wei
 */
function getGasCaps() {
  const maxFeeGwei = Number(process.env.MAX_FEE_GWEI || '50');
  const maxPriorityGwei = Number(process.env.MAX_PRIORITY_FEE_GWEI || '2');
  
  return {
    maxFeePerGas: BigInt(maxFeeGwei) * BigInt(1e9), // Convert gwei to wei
    maxPriorityFeePerGas: BigInt(maxPriorityGwei) * BigInt(1e9)
  };
}

/**
 * Query the actual MNESTR output for a given WAPE input from Camelot DEX
 * This gives us the real-time exchange rate based on current liquidity
 */
async function querySwapRate(wapeAmount: bigint): Promise<bigint> {
  try {
    // Use Camelot Router (UniswapV2-compatible) to query rates
    // NOTE: We use YakRouter for actual swaps, but YakRouter doesn't have getAmountsOut
    const CAMELOT_ROUTER = '0x18E621B64d7808c3C47bccbbD7485d23F257D26f';
    
    console.log(`[RateQuery] Querying Camelot Router: ${CAMELOT_ROUTER}`);
    console.log(`[RateQuery] Path: ${cfg.wape} → ${cfg.mnestr}`);
    console.log(`[RateQuery] Amount: ${formatEther(wapeAmount)} WAPE`);
    
    const camelotRouter = new Contract(CAMELOT_ROUTER, CAMELOT_ROUTER_ABI, treasury);
    const path = [cfg.wape, cfg.mnestr];
    
    const amounts = await camelotRouter.getAmountsOut(wapeAmount, path);
    const expectedMNESTR = amounts[1]; // amounts[0] = input, amounts[1] = output
    
    console.log(`[RateQuery] ✅ Expected output: ${formatEther(expectedMNESTR)} MNESTR`);
    const rate = (expectedMNESTR * 10n**18n) / wapeAmount;
    console.log(`[RateQuery] Current rate: ${formatEther(rate)} MNESTR per WAPE`);
    
    return expectedMNESTR;
  } catch (error: any) {
    console.error(`[RateQuery] ❌ Failed to query rate:`, error.message);
    // Fallback to conservative estimate if query fails
    const conservativeRate = 45000n * 10n**18n; // Very conservative 45k MNESTR per WAPE
    const fallbackOutput = (wapeAmount * conservativeRate) / 10n**18n;
    console.log(`[RateQuery] Using fallback conservative estimate: ${formatEther(fallbackOutput)} MNESTR`);
    return fallbackOutput;
  }
}

/**
 * Execute the burn flywheel:
 * 1. Check treasury APE balance
 * 2. Swap 99% APE → MNESTR
 * 3. Burn MNESTR to 0xdead
 * 4. Send 1% APE to trading wallet for gas
 * 
 * @returns The amount of MNESTR burned
 */
export async function executeBurn(): Promise<{
  apeReceived: string;
  apeForSwap: string;
  apeForGas: string;
  mnestrBurned: string;
  txHash: string;
}> {
  const treasuryAddr = await treasury.getAddress();
  console.log(`\n[Treasury] Starting burn sequence...`);
  console.log(`[Treasury] Address: ${treasuryAddr}`);
  
  // 1. Check treasury APE balance
  const apeBalance = await treasury.provider!.getBalance(treasuryAddr);
  console.log(`[Treasury] APE Balance: ${formatEther(apeBalance)} APE`);
  
  if (apeBalance === 0n) {
    throw new Error('No APE in treasury to process');
  }
  
  // 2. Reserve gas FIRST (0.5 APE for swap transaction), then calculate swap amount
  const gasReserve = parseEther('0.5'); // Keep 0.5 APE for gas (DEX swaps are expensive)
  
  if (apeBalance <= gasReserve) {
    throw new Error(`Insufficient balance for swap (need > ${formatEther(gasReserve)} APE for gas)`);
  }
  
  const swappableBalance = apeBalance - gasReserve; // Remaining after gas reserve
  const apeForSwap = (swappableBalance * 99n) / 100n; // 99% of swappable
  const apeForTradingWallet = swappableBalance - apeForSwap; // 1% to trading wallet
  
  console.log(`[Treasury] Gas reserve: ${formatEther(gasReserve)} APE (kept in treasury)`);
  console.log(`[Treasury] Swappable: ${formatEther(swappableBalance)} APE`);
  console.log(`[Treasury] Will swap: ${formatEther(apeForSwap)} APE (99% of swappable)`);
  console.log(`[Treasury] Will send to trading: ${formatEther(apeForTradingWallet)} APE (1% of swappable)`);
  
  // 3. Swap WAPE → MNESTR via YakRouter (token-in variant)
  // Use the proven working path from successful on-chain tx
  
  const YAK_ROUTER = '0x2b59Eb03865D18d8B62a5956BBbFaE352fc1C148';
  const ADAPTER = '0xf05902d8eb53a354c9ddc67175df3d9bee1f9581'; // Proven working adapter (lowercase)
  const POOL = '0x7101842054d75e8f2b15c0026254b0d7c525d594'; // The actual WAPE/MNESTR pool (lowercase)
  
  console.log(`[Treasury] Using YakRouter (token-in swap)`);
  console.log(`[Treasury] Treasury signer: ${treasuryAddr}`);
  console.log(`[Treasury] Router: ${YAK_ROUTER}`);
  console.log(`[Treasury] Path: WAPE → MNESTR (via adapter)`);
  
  // Query the actual expected output from Camelot DEX
  const expectedMNESTR = await querySwapRate(apeForSwap);
  const minMNESTR = (expectedMNESTR * 90n) / 100n; // 10% slippage tolerance
  
  console.log(`[Treasury] Expected MNESTR (from DEX): ${formatEther(expectedMNESTR)}`);
  console.log(`[Treasury] Min MNESTR (10% slippage): ${formatEther(minMNESTR)}`);
  
  // Get gas price caps for all transactions
  const gasCaps = getGasCaps();
  console.log(`[Gas] Max fee: ${Number(gasCaps.maxFeePerGas) / 1e9} Gwei, Max priority: ${Number(gasCaps.maxPriorityFeePerGas) / 1e9} Gwei`);
  
  // Step 1: Wrap native APE → WAPE
  console.log(`[Treasury] Step 1: Wrapping ${formatEther(apeForSwap)} APE → WAPE...`);
  const wape = new Contract(cfg.wape, WAPE_ABI, treasury);
  const wrapTx = await wape.deposit({ 
    value: apeForSwap, 
    gasLimit: 100000,
    ...gasCaps
  });
  console.log(`[Treasury] Wrap tx submitted: ${wrapTx.hash}`);
  await wrapTx.wait(1); // Wait for 1 confirmation only
  console.log(`[Treasury] ✅ Wrapped`);
  
  // Step 2: Approve YakRouter to spend WAPE
  console.log(`[Treasury] Step 2: Approving YakRouter...`);
  const approveTx = await wape.approve(YAK_ROUTER, apeForSwap, gasCaps);
  console.log(`[Treasury] Approve tx submitted: ${approveTx.hash}`);
  await approveTx.wait(1);
  console.log(`[Treasury] ✅ Approved`);
  
  // Step 3: Execute YakRouter swap (token-in variant with WAPE)
  // Manually encode calldata to avoid ethers tuple encoding issues
  console.log(`[Treasury] Step 3: Executing YakRouter swapNoSplit (token-in)...`);
  
  console.log(`[Treasury] AmountIn: ${formatEther(apeForSwap)} WAPE`);
  console.log(`[Treasury] AmountOutMin: ${formatEther(minMNESTR)} MNESTR`);
  console.log(`[Treasury] Adapter: ${ADAPTER}`);
  console.log(`[Treasury] Pool: ${POOL}`);
  
  // Manually encode the calldata with correct selector (0xce6e28f2)
  const { AbiCoder } = await import('ethers');
  const abiCoder = AbiCoder.defaultAbiCoder();
  
  // Encode: swapNoSplit(Trade _trade, uint256 _fee, address _to)
  // Trade struct: (uint256 amountIn, uint256 amountOut, address[] path, address[] adapters, address[] pools)
  // Use lowercase addresses to avoid checksum issues in AbiCoder
  const paramsEncoded = abiCoder.encode(
    ['tuple(uint256,uint256,address[],address[],address[])', 'uint256', 'address'],
    [
      [apeForSwap, minMNESTR, [cfg.wape.toLowerCase(), cfg.mnestr.toLowerCase()], [ADAPTER], [POOL]],
      0n,
      treasuryAddr.toLowerCase()
    ]
  );
  
  console.log(`[Treasury] Arrays: path[2], adapters[1], pools[1]`);
  
  // Build calldata with correct method selector
  const methodSelector = '0xce6e28f2'; // swapNoSplit selector
  const calldata = methodSelector + paramsEncoded.slice(2);
  
  console.log(`[Treasury] Method selector: ${methodSelector} (correct!)`);
  console.log(`[Treasury] Calldata length: ${calldata.length} chars`);
  
  // Send raw transaction with manually encoded calldata
  const swapTx = await treasury.sendTransaction({
    to: YAK_ROUTER,
    data: calldata,
    value: 0, // token-in, no value
    gasLimit: 300000,
    ...gasCaps
  });
  
  console.log(`[Treasury] Swap tx submitted: ${swapTx.hash}`);
  const swapReceipt = await swapTx.wait(1);
  console.log(`[Treasury] ✅ Swap confirmed in block ${swapReceipt!.blockNumber}`);
  
  // 4. Check MNESTR balance
  const mnestrContract = new Contract(cfg.mnestr, ERC20_ABI, treasury);
  const mnestrBalance = await mnestrContract.balanceOf(treasuryAddr);
  
  console.log(`[Treasury] MNESTR Balance: ${formatEther(mnestrBalance)} MNESTR`);
  
  // 5. Burn MNESTR to 0xdead
  let burnTxHash = '';
  
  // Security Fix #7: Balance validation - don't burn if balance is 0
  if (mnestrBalance === 0n) {
    console.log(`[Treasury] ⚠️ No MNESTR to burn (swap may have failed)`);
    return {
      apeReceived: formatEther(apeBalance),
      apeForSwap: formatEther(apeForSwap),
      apeForGas: formatEther(gasReserve),
      mnestrBurned: '0',
      txHash: ''
    };
  }
  
  console.log(`[Treasury] Burning ${formatEther(mnestrBalance)} MNESTR...`);
  const burnTx = await mnestrContract.transfer(BURN_ADDRESS, mnestrBalance, gasCaps);
  burnTxHash = burnTx.hash;
  console.log(`[Treasury] Burn tx submitted: ${burnTxHash}`);
  await burnTx.wait(1);
  console.log(`[Treasury] 🔥 Burned ${formatEther(mnestrBalance)} MNESTR!`);
  
  // 6. Send 1% APE to trading wallet for gas
  if (apeForTradingWallet > 0n) {
    console.log(`[Treasury] Sending ${formatEther(apeForTradingWallet)} APE to trading wallet...`);
    const gasTx = await treasury.sendTransaction({
      to: cfg.flywheelAddr,
      value: apeForTradingWallet,
      gasLimit: 100000,
      ...gasCaps
    });
    console.log(`[Treasury] Gas transfer tx submitted: ${gasTx.hash}`);
    await gasTx.wait(1);
    console.log(`[Treasury] ✅ Sent to trading wallet`);
  }
  
  console.log(`[Treasury] ✅✅✅ FLYWHEEL BURN COMPLETE! ✅✅✅`);
  
  // Record success metrics
  recordBurn();
  recordDailyBurn(Number(formatEther(mnestrBalance)));
  
  // Alert success to Discord
  await alertSuccess('Burn completed', {
    'MNESTR Burned': formatEther(mnestrBalance),
    'APE Swapped': formatEther(apeForSwap),
    'Transaction': `https://apescan.io/tx/${burnTxHash}`,
  });
  
  return {
    apeReceived: formatEther(apeBalance),
    apeForSwap: formatEther(apeForSwap),
    apeForGas: formatEther(gasReserve),
    mnestrBurned: formatEther(mnestrBalance),
    txHash: burnTxHash
  };
}
