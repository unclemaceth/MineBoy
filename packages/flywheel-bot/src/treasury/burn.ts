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

// Camelot V3 SwapRouter ABI (standard Algebra/UniV3 interface)
const V3_SWAP_ROUTER_ABI = [
  "function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) payable returns (uint256 amountOut)"
];

// WAPE ABI for wrapping
const WAPE_ABI = [
  'function deposit() payable',
  'function approve(address spender, uint256 amount) returns (bool)'
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
  
  // 3. Swap APE → MNESTR via Camelot V3 SwapRouter
  // Simple V3 approach: Wrap → Approve → Swap
  
  const V3_ROUTER = '0xC69Dc28924930583024E067b2B3d773018F4EB52';
  
  console.log(`[Treasury] Using Camelot V3 SwapRouter (direct)`);
  console.log(`[Treasury] Treasury signer: ${treasuryAddr}`);
  console.log(`[Treasury] V3 Router: ${V3_ROUTER}`);
  console.log(`[Treasury] Path: WAPE → MNESTR`);
  
  // Use conservative slippage based on observed rate (~61k MNESTR per APE)
  const ratePerAPE = 61000n * 10n**18n; // ~61k MNESTR per APE
  const expectedMNESTR = (apeForSwap * ratePerAPE) / 10n**18n;
  const minMNESTR = (expectedMNESTR * 90n) / 100n; // 10% slippage tolerance
  
  console.log(`[Treasury] Expected MNESTR (estimated): ${formatEther(expectedMNESTR)}`);
  console.log(`[Treasury] Min MNESTR (10% slippage): ${formatEther(minMNESTR)}`);
  
  // Step 1: Wrap native APE → WAPE
  console.log(`[Treasury] Step 1: Wrapping ${formatEther(apeForSwap)} APE → WAPE...`);
  const wape = new Contract(cfg.wape, WAPE_ABI, treasury);
  const wrapTx = await wape.deposit({ value: apeForSwap, gasLimit: 100000 });
  console.log(`[Treasury] Wrap tx submitted: ${wrapTx.hash}`);
  await wrapTx.wait(1); // Wait for 1 confirmation only
  console.log(`[Treasury] ✅ Wrapped`);
  
  // Step 2: Approve V3 Router to spend WAPE
  console.log(`[Treasury] Step 2: Approving V3 Router...`);
  const approveTx = await wape.approve(V3_ROUTER, apeForSwap);
  console.log(`[Treasury] Approve tx submitted: ${approveTx.hash}`);
  await approveTx.wait(1);
  console.log(`[Treasury] ✅ Approved`);
  
  // Step 3: Execute V3 swap
  console.log(`[Treasury] Step 3: Executing V3 swap WAPE → MNESTR...`);
  const router = new Contract(V3_ROUTER, V3_SWAP_ROUTER_ABI, treasury);
  
  // Encode path for V3: tokenIn + tokenOut (no fee needed for Algebra)
  const { solidityPacked } = await import('ethers');
  const encodedPath = solidityPacked(
    ['address', 'address'],
    [cfg.wape, cfg.mnestr]
  );
  
  const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
  const params = {
    path: encodedPath,
    recipient: treasuryAddr,
    deadline,
    amountIn: apeForSwap,
    amountOutMinimum: minMNESTR
  };
  
  console.log(`[Treasury] AmountIn: ${formatEther(apeForSwap)} WAPE`);
  console.log(`[Treasury] AmountOutMin: ${formatEther(minMNESTR)} MNESTR`);
  
  const swapTx = await router.exactInput(params, { gasLimit: 500000 });
  console.log(`[Treasury] Swap tx submitted: ${swapTx.hash}`);
  const swapReceipt = await swapTx.wait(1);
  console.log(`[Treasury] ✅ Swap confirmed in block ${swapReceipt!.blockNumber}`);
  
  // 4. Check MNESTR balance
  const mnestrContract = new Contract(cfg.mnestr, ERC20_ABI, treasury);
  const mnestrBalance = await mnestrContract.balanceOf(treasuryAddr);
  
  console.log(`[Treasury] MNESTR Balance: ${formatEther(mnestrBalance)} MNESTR`);
  
  // 5. Burn MNESTR to 0xdead
  if (mnestrBalance > 0n) {
    console.log(`[Treasury] Burning ${formatEther(mnestrBalance)} MNESTR...`);
    const burnTx = await mnestrContract.transfer(BURN_ADDRESS, mnestrBalance);
    console.log(`[Treasury] Burn tx submitted: ${burnTx.hash}`);
    await burnTx.wait(1);
    console.log(`[Treasury] 🔥 Burned ${formatEther(mnestrBalance)} MNESTR!`);
  } else {
    console.log(`[Treasury] ⚠️ No MNESTR to burn (swap may have failed)`);
  }
  
  // 6. Send 1% APE to trading wallet for gas
  if (apeForTradingWallet > 0n) {
    console.log(`[Treasury] Sending ${formatEther(apeForTradingWallet)} APE to trading wallet...`);
    const gasTx = await treasury.sendTransaction({
      to: cfg.flywheelAddr,
      value: apeForTradingWallet,
      gasLimit: 100000
    });
    console.log(`[Treasury] Gas transfer tx submitted: ${gasTx.hash}`);
    await gasTx.wait(1);
    console.log(`[Treasury] ✅ Sent to trading wallet`);
  }
  
  return {
    apeReceived: formatEther(apeBalance),
    apeForSwap: formatEther(apeForSwap),
    apeForGas: formatEther(gasReserve),
    mnestrBurned: formatEther(mnestrBalance),
    txHash: burnTx.hash
  };
}
