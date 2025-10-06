/**
 * Test fulfilling by sending the raw encoded data from backend
 */
import { flywheel } from '../src/wallets.js';
import axios from 'axios';

async function main() {
  console.log('🧪 Testing raw transaction from backend encoding...\n');
  
  const flywheelAddr = await flywheel.getAddress();
  console.log(`Flywheel: ${flywheelAddr}`);
  console.log();
  
  // Get the encoded transaction from backend
  console.log('📡 Fetching encoded tx from backend...');
  const response = await axios.post('https://mineboy-g5xo.onrender.com/market/build-fill', {
    tokenId: '83',
    buyer: flywheelAddr
  }, {
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  const txData = response.data;
  console.log(`  to: ${txData.to}`);
  console.log(`  value: ${txData.value} (${Number(txData.value) / 1e18} APE)`);
  console.log(`  data: ${txData.data.substring(0, 66)}...${txData.data.slice(-32)}`);
  console.log();
  
  try {
    console.log('📤 Estimating gas...');
    const gasEstimate = await flywheel.estimateGas({
      to: txData.to,
      data: txData.data,
      value: BigInt(txData.value)
    });
    console.log(`  Gas estimate: ${gasEstimate}`);
    console.log();
    
    console.log('📤 Sending transaction...');
    const tx = await flywheel.sendTransaction({
      to: txData.to,
      data: txData.data,
      value: BigInt(txData.value),
      gasLimit: gasEstimate * 120n / 100n
    });
    
    console.log(`✅ Transaction sent: ${tx.hash}`);
    console.log('⏳ Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`  Gas used: ${receipt.gasUsed}`);
    console.log();
    console.log('🎉 SUCCESS! The order was fulfilled!');
  } catch (error: any) {
    console.log('❌ Transaction failed:');
    console.log(`  ${error.message}`);
    console.log();
    
    if (error.shortMessage) {
      console.log(`  Short: ${error.shortMessage}`);
    }
    if (error.data) {
      console.log(`  Data: ${error.data}`);
    }
    if (error.code) {
      console.log(`  Code: ${error.code}`);
    }
    if (error.reason) {
      console.log(`  Reason: ${error.reason}`);
    }
  }
}

main().catch(console.error);
