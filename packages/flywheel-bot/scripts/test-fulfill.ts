/**
 * Test fulfilling the order using ethers directly
 * This will help us see the exact revert reason
 */
import { Contract, parseEther } from 'ethers';
import { flywheel } from '../src/wallets.js';
import axios from 'axios';

const SEAPORT = '0x0000000000000068F116a894984e2DB1123eB395';
const ZERO32 = '0x' + '00'.repeat(32);

async function main() {
  console.log('🧪 Testing order fulfillment...\n');
  
  // Fetch the order from backend
  const response = await axios.get('https://mineboy-g5xo.onrender.com/market/orders/83');
  const orderData = response.data.order.order.data;
  
  const seaport = new Contract(
    SEAPORT,
    ['function fulfillOrder((address,address,(uint8,address,uint256,uint256,uint256)[],(uint8,address,uint256,uint256,uint256,address)[],uint8,uint256,uint256,bytes32,uint256,bytes32,uint256),bytes32) payable returns (bool)'],
    flywheel
  );
  
  const order = {
    offerer: orderData.offerer,
    zone: orderData.zone,
    offer: orderData.offer,
    consideration: orderData.consideration,
    orderType: orderData.orderType,
    startTime: orderData.startTime,
    endTime: orderData.endTime,
    zoneHash: orderData.zoneHash,
    salt: orderData.salt,
    conduitKey: orderData.conduitKey,
    counter: orderData.counter
  };
  
  console.log('Order parameters:');
  console.log(`  Offerer: ${order.offerer}`);
  console.log(`  ConduitKey: ${order.conduitKey}`);
  console.log(`  Counter: ${order.counter}`);
  console.log(`  OrderType: ${order.orderType}`);
  console.log();
  
  // Calculate total value
  const totalValue = order.consideration.reduce((sum: bigint, c: any) => {
    return sum + BigInt(c.endAmount);
  }, 0n);
  
  console.log(`Total value to send: ${totalValue} wei (${Number(totalValue) / 1e18} APE)`);
  console.log();
  
  try {
    console.log('📤 Estimating gas...');
    const gasEstimate = await seaport.fulfillOrder.estimateGas(order, ZERO32, {
      value: totalValue
    });
    console.log(`   Gas estimate: ${gasEstimate}`);
    
    console.log('📤 Sending test transaction...');
    const tx = await seaport.fulfillOrder(order, ZERO32, {
      value: totalValue,
      gasLimit: gasEstimate * 120n / 100n // 20% buffer
    });
    
    console.log(`✅ Transaction sent: ${tx.hash}`);
    console.log('⏳ Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed}`);
  } catch (error: any) {
    console.log('❌ Transaction failed:');
    console.log(`   ${error.message}`);
    console.log();
    
    if (error.shortMessage) {
      console.log(`   Short message: ${error.shortMessage}`);
    }
    if (error.data) {
      console.log(`   Error data: ${error.data}`);
    }
    if (error.reason) {
      console.log(`   Reason: ${error.reason}`);
    }
    if (error.code) {
      console.log(`   Code: ${error.code}`);
    }
    
    // Try to decode the error
    if (error.error?.data) {
      console.log(`   Raw error data: ${error.error.data}`);
    }
    
    console.log();
    console.log('Full error object:');
    console.log(JSON.stringify(error, null, 2));
  }
}

main().catch(console.error);
