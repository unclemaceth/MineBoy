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

const DEX_ROUTER_ABI = [
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function getAmountsOut(uint amountIn, address[] path) view returns (uint[])'
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
  
  // 2. Calculate 99% for swap, 1% for gas
  const apeForSwap = (apeBalance * 99n) / 100n;
  const apeForGas = apeBalance - apeForSwap;
  
  console.log(`[Treasury] Swap amount: ${formatEther(apeForSwap)} APE (99%)`);
  console.log(`[Treasury] Gas reserve: ${formatEther(apeForGas)} APE (1%)`);
  
  // 3. Swap APE → MNESTR via Camelot DEX
  const dexRouter = new Contract(cfg.dexRouter, DEX_ROUTER_ABI, treasury);
  
  // Get expected MNESTR output
  const path = [cfg.wape, cfg.mnestr]; // WAPE → MNESTR
  const amountsOut = await dexRouter.getAmountsOut(apeForSwap, path);
  const expectedMNESTR = amountsOut[1];
  const minMNESTR = (expectedMNESTR * 95n) / 100n; // 5% slippage tolerance
  
  console.log(`[Treasury] Expected MNESTR: ${formatEther(expectedMNESTR)}`);
  console.log(`[Treasury] Min MNESTR (5% slippage): ${formatEther(minMNESTR)}`);
  
  const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
  
  console.log(`[Treasury] Executing swap: APE → MNESTR...`);
  const swapTx = await dexRouter.swapExactETHForTokens(
    minMNESTR,
    path,
    treasuryAddr, // MNESTR goes to treasury
    deadline,
    { value: apeForSwap }
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
  if (apeForGas > 0n) {
    console.log(`[Treasury] Sending gas reserve to trading wallet...`);
    const gasTx = await treasury.sendTransaction({
      to: cfg.flywheelAddr,
      value: apeForGas
    });
    
    console.log(`[Treasury] Gas tx: ${gasTx.hash}`);
    await gasTx.wait();
    console.log(`[Treasury] Gas sent: ${formatEther(apeForGas)} APE → ${cfg.flywheelAddr}`);
  }
  
  return {
    apeReceived: formatEther(apeBalance),
    apeForSwap: formatEther(apeForSwap),
    apeForGas: formatEther(apeForGas),
    mnestrBurned: formatEther(mnestrBalance),
    txHash: burnTx.hash
  };
}
