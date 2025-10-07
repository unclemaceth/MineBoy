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

// YakRouter (aggregator) ABI - uses native APE, no wrapping needed!
const YAK_ROUTER_ABI = [
  {
    "inputs": [
      {
        "components": [
          {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
          {"internalType": "uint256", "name": "amountOut", "type": "uint256"},
          {"internalType": "address[]", "name": "path", "type": "address[]"},
          {"internalType": "address[]", "name": "adapters", "type": "address[]"}
        ],
        "internalType": "struct YakRouter.Trade",
        "name": "_trade",
        "type": "tuple"
      },
      {"internalType": "uint256", "name": "_fee", "type": "uint256"},
      {"internalType": "address", "name": "_to", "type": "address"}
    ],
    "name": "swapNoSplitFromETH",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
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
  
  // 3. Swap APE → MNESTR via YakRouter (aggregator)
  // Uses native APE directly - no wrapping needed!
  
  console.log(`[Treasury] Using YakRouter (DEX aggregator)`);
  console.log(`[Treasury] Treasury signer: ${treasuryAddr}`);
  console.log(`[Treasury] Router: ${cfg.dexRouter}`);
  console.log(`[Treasury] Path: APE → MNESTR`);
  
  // Use conservative slippage based on observed rate (~61k MNESTR per APE)
  const ratePerAPE = 61000n * 10n**18n; // ~61k MNESTR per APE
  const expectedMNESTR = (apeForSwap * ratePerAPE) / 10n**18n;
  const minMNESTR = (expectedMNESTR * 90n) / 100n; // 10% slippage tolerance (conservative)
  
  console.log(`[Treasury] Expected MNESTR (estimated): ${formatEther(expectedMNESTR)}`);
  console.log(`[Treasury] Min MNESTR (10% slippage): ${formatEther(minMNESTR)}`);
  
  const router = new Contract(cfg.dexRouter, YAK_ROUTER_ABI, treasury);
  
  // YakRouter adapters (from successful swap tx)
  const adapters = [
    '0xf05902d8eb53a354c9ddc67175df3d9bee1f9581', // Adapter 1
    '0x7101842054d75e8f2b15c0026254b0d7c525d594'  // Pool address
  ];
  
  const trade = {
    amountIn: apeForSwap,
    amountOut: minMNESTR,
    path: [cfg.wape, cfg.mnestr], // WAPE → MNESTR (router wraps internally)
    adapters
  };
  
  console.log(`[Treasury] Executing YakRouter swap (native APE)...`);
  console.log(`[Treasury] AmountIn: ${formatEther(apeForSwap)} APE`);
  console.log(`[Treasury] AmountOutMin: ${formatEther(minMNESTR)} MNESTR`);
  
  // Execute swap with native APE (payable function)
  const swapTx = await router.swapNoSplitFromETH(
    trade,
    0, // No fee
    treasuryAddr, // Recipient
    { value: apeForSwap, gasLimit: 500000 }
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
