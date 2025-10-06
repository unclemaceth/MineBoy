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

const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';

// Camelot V3 / Algebra Router ABI
const ALGEBRA_ROUTER_ABI = [
  'function exactInputSingle(tuple(address tokenIn, address tokenOut, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 limitSqrtPrice)) payable returns (uint256 amountOut)'
];

// Algebra Quoter V2 ABI (for getting expected output)
const ALGEBRA_QUOTER_ABI = [
  'function quoteExactInputSingle(address tokenIn, address tokenOut, uint256 amountIn, uint160 limitSqrtPrice) external returns (uint256 amountOut, uint16 fee)'
];

const ERC20_ABI = [
  'function transfer(address to, uint amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)'
];

// Camelot V3 Quoter address on ApeChain (need to verify this)
const QUOTER_V3 = '0x0Fc73040b26E9bC8514fA028D998E73A254Fa76E'; // Camelot Algebra Quoter

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
  
  // 3. Swap APE → MNESTR via Camelot V3 (Algebra)
  const router = new Contract(cfg.dexRouter, ALGEBRA_ROUTER_ABI, treasury);
  const quoter = new Contract(QUOTER_V3, ALGEBRA_QUOTER_ABI, treasury.provider);
  
  console.log(`[Treasury] Using Camelot V3 (Algebra) router`);
  console.log(`[Treasury] Path: WAPE → MNESTR`);
  
  // Get quote from Algebra Quoter
  const [expectedMNESTR, fee] = await quoter.quoteExactInputSingle(
    cfg.wape,
    cfg.mnestr,
    apeForSwap,
    0n // limitSqrtPrice = 0 (no price limit)
  );
  
  const minMNESTR = (expectedMNESTR * 95n) / 100n; // 5% slippage tolerance
  
  console.log(`[Treasury] Expected MNESTR: ${formatEther(expectedMNESTR)}`);
  console.log(`[Treasury] Pool fee: ${fee} (${Number(fee) / 100}%)`);
  console.log(`[Treasury] Min MNESTR (5% slippage): ${formatEther(minMNESTR)}`);
  
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 minutes
  
  console.log(`[Treasury] Executing V3 swap: APE → MNESTR...`);
  console.log(`[Treasury] Sending ${formatEther(apeForSwap)} APE as msg.value`);
  
  // Algebra V3 swap parameters
  const params = {
    tokenIn: cfg.wape,
    tokenOut: cfg.mnestr,
    recipient: treasuryAddr,
    deadline,
    amountIn: apeForSwap,
    amountOutMinimum: minMNESTR,
    limitSqrtPrice: 0n // No price limit
  };
  
  // Execute V3 swap (payable, router auto-wraps native APE → WAPE)
  const swapTx = await router.exactInputSingle(params, { 
    value: apeForSwap,
    gasLimit: 500000 // V3 uses more gas than V2
  });
  
  console.log(`[Treasury] Swap tx: ${swapTx.hash}`);
  const swapReceipt = await swapTx.wait();
  console.log(`[Treasury] Swap confirmed in block ${swapReceipt!.blockNumber}`);
  
  // 4. Check MNESTR balance
  const mnestrContract = new Contract(cfg.mnestr, ERC20_ABI, treasury);
  const mnestrBalance = await mnestrContract.balanceOf(treasuryAddr);
  
  console.log(`[Treasury] MNESTR Balance: ${formatEther(mnestrBalance)} MNESTR`);
  
  // 5. Burn MNESTR to 0xdead
  console.log(`[Treasury] Burning MNESTR...`);
  const burnTx = await mnestrContract.transfer(BURN_ADDRESS, mnestrBalance);
  
  console.log(`[Treasury] Burn tx: ${burnTx.hash}`);
  const burnReceipt = await burnTx.wait();
  console.log(`[Treasury] Burn confirmed in block ${burnReceipt!.blockNumber}`);
  console.log(`[Treasury] 🔥 Burned ${formatEther(mnestrBalance)} MNESTR!`);
  
  // 6. Send 1% APE to trading wallet for gas
  if (apeForTradingWallet > 0n) {
    console.log(`[Treasury] Sending 1% to trading wallet...`);
    const gasTx = await treasury.sendTransaction({
      to: cfg.flywheelAddr,
      value: apeForTradingWallet
    });
    
    console.log(`[Treasury] Transfer tx: ${gasTx.hash}`);
    await gasTx.wait();
    console.log(`[Treasury] Sent: ${formatEther(apeForTradingWallet)} APE → ${cfg.flywheelAddr}`);
  }
  
  return {
    apeReceived: formatEther(apeBalance),
    apeForSwap: formatEther(apeForSwap),
    apeForGas: formatEther(gasReserve),
    mnestrBurned: formatEther(mnestrBalance),
    txHash: burnTx.hash
  };
}
