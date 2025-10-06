/**
 * Test swap directly with eth_call to see the exact error
 */
import { JsonRpcProvider, Contract, parseEther, formatEther } from 'ethers';
import { treasury } from '../src/wallets.js';
import { cfg } from '../src/config.js';

const DEX_ROUTER_ABI = [
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)'
];

async function main() {
  console.log('\n=== TESTING SWAP ===\n');
  
  const treasuryAddr = await treasury.getAddress();
  const router = new Contract(cfg.dexRouter, DEX_ROUTER_ABI, treasury);
  
  const apeForSwap = parseEther('1.5');
  const path = [cfg.wape, cfg.mnestr];
  const deadline = Math.floor(Date.now() / 1000) + 300;
  const minOut = parseEther('1'); // Very low minimum for testing
  
  console.log('Treasury:', treasuryAddr);
  console.log('Router:', cfg.dexRouter);
  console.log('WAPE:', cfg.wape);
  console.log('MNESTR:', cfg.mnestr);
  console.log('APE to swap:', formatEther(apeForSwap));
  console.log('Path:', path);
  console.log('Deadline:', new Date(deadline * 1000).toISOString());
  console.log();
  
  // Try to estimate gas
  console.log('Attempting estimateGas...');
  try {
    const gas = await router.swapExactETHForTokens.estimateGas(
      minOut,
      path,
      treasuryAddr,
      deadline,
      { value: apeForSwap }
    );
    console.log('✅ Gas estimate:', gas.toString());
  } catch (error: any) {
    console.error('❌ estimateGas failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Error data:', error.data);
    
    // Try direct eth_call
    console.log('\nTrying direct eth_call...');
    const provider = treasury.provider as JsonRpcProvider;
    
    const calldata = router.interface.encodeFunctionData('swapExactETHForTokens', [
      minOut,
      path,
      treasuryAddr,
      deadline
    ]);
    
    console.log('Calldata:', calldata);
    
    try {
      const result = await provider.call({
        to: cfg.dexRouter,
        from: treasuryAddr,
        data: calldata,
        value: apeForSwap.toString()
      });
      console.log('✅ eth_call result:', result);
    } catch (callError: any) {
      console.error('❌ eth_call also failed:', callError.message);
      
      // Check if the pair exists
      console.log('\n=== Checking Pool ===');
      const factoryABI = [
        'function getPair(address tokenA, address tokenB) external view returns (address pair)'
      ];
      
      // Try Camelot factory (replace with actual factory address if different)
      const CAMELOT_FACTORY = '0x6EcCab422D763aC031210895C81787E87B43A652'; // This is a guess
      const factory = new Contract(CAMELOT_FACTORY, factoryABI, treasury);
      
      try {
        const pairAddr = await factory.getPair(cfg.wape, cfg.mnestr);
        console.log('Pair address:', pairAddr);
        if (pairAddr === '0x0000000000000000000000000000000000000000') {
          console.log('❌ Pool does not exist for WAPE/MNESTR!');
        } else {
          console.log('✅ Pool exists:', pairAddr);
        }
      } catch (factoryError: any) {
        console.log('Could not check factory:', factoryError.message);
      }
    }
  }
}

main().catch(console.error);
