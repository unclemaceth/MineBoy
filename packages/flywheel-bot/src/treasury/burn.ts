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

// UniswapV2-style Router ABI (works with V2 pools)
const ROUTER_V2_ABI = [
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
];

// WAPE ABI (for wrapping native APE)
const WAPE_ABI = [
  'function deposit() payable',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)'
];

const ERC20_ABI = [
  'function transfer(address to, uint amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)'
];

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
  // V3 requires: Wrap → Approve → Swap (NO msg.value on swap)
  
  console.log(`[Treasury] Using Camelot V3 (Algebra) router`);
  console.log(`[Treasury] Treasury signer: ${treasuryAddr}`);
  console.log(`[Treasury] Router: ${cfg.dexRouter}`);
  console.log(`[Treasury] Path: WAPE → MNESTR`);
  
  // Use conservative slippage based on observed rate (~61k MNESTR per APE)
  const ratePerAPE = 61000n * 10n**18n; // ~61k MNESTR per APE
  const expectedMNESTR = (apeForSwap * ratePerAPE) / 10n**18n;
  const minMNESTR = (expectedMNESTR * 90n) / 100n; // 10% slippage tolerance (conservative)
  
  console.log(`[Treasury] Expected MNESTR (estimated): ${formatEther(expectedMNESTR)}`);
  console.log(`[Treasury] Min MNESTR (10% slippage): ${formatEther(minMNESTR)}`);
  
  // Step 1: Wrap native APE → WAPE (THIS is where value is sent)
  console.log(`[Treasury] Step 1: Wrapping ${formatEther(apeForSwap)} APE → WAPE...`);
  const wape = new Contract(cfg.wape, WAPE_ABI, treasury);
  const wrapTx = await wape.deposit({ value: apeForSwap, gasLimit: 100000 });
  await wrapTx.wait();
  console.log(`[Treasury] ✅ Wrapped APE → WAPE (tx: ${wrapTx.hash})`);
  
  // Step 2: Approve router to spend WAPE
  console.log(`[Treasury] Step 2: Approving router to spend ${formatEther(apeForSwap)} WAPE...`);
  const approveTx = await wape.approve(cfg.dexRouter, apeForSwap);
  await approveTx.wait();
  console.log(`[Treasury] ✅ Approved router (tx: ${approveTx.hash})`);
  
  // Step 3: Execute V2 swap (WAPE → MNESTR)
  console.log(`[Treasury] Step 3: Executing V2 swap WAPE → MNESTR...`);
  const router = new Contract(cfg.dexRouter, ROUTER_V2_ABI, treasury);
  
  const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
  const path = [cfg.wape, cfg.mnestr]; // WAPE → MNESTR
  
  console.log(`[Treasury] Router: ${cfg.dexRouter}`);
  console.log(`[Treasury] Path: ${path.join(' → ')}`);
  console.log(`[Treasury] AmountIn: ${formatEther(apeForSwap)} WAPE`);
  console.log(`[Treasury] AmountOutMin: ${formatEther(minMNESTR)} MNESTR`);
  console.log(`[Treasury] Deadline: ${new Date(deadline * 1000).toISOString()}`);
  
  // Execute V2 swap (WAPE already wrapped and approved)
  const swapTx = await router.swapExactTokensForTokens(
    apeForSwap,
    minMNESTR,
    path,
    treasuryAddr,
    deadline
  );
  
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
