/**
 * Use Seaport's validate function to check the order on-chain
 */
import { flywheel } from '../src/wallets.js';
import { Contract } from 'ethers';
import axios from 'axios';

const SEAPORT = '0x0000000000000068F116a894984e2DB1123eB395';

async function main() {
  console.log('🔍 Validating order on Seaport contract...\n');
  
  // Fetch the order
  const response = await axios.get('https://mineboy-g5xo.onrender.com/market/orders/83');
  const orderData = response.data.order.order.data;
  
  const seaport = new Contract(
    SEAPORT,
    ['function validate(tuple(address,address,tuple(uint8,address,uint256,uint256,uint256)[],tuple(uint8,address,uint256,uint256,uint256,address)[],uint8,uint256,uint256,bytes32,uint256,bytes32,uint256)[] orders) returns (bool)'],
    flywheel
  );
  
  // Build the order object for validation
  const order = {
    parameters: {
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
      totalOriginalConsiderationItems: orderData.consideration.length
    },
    signature: orderData.signature
  };
  
  console.log(`Order counter: ${orderData.counter}`);
  console.log(`Offerer: ${orderData.offerer}`);
  console.log(`Signature: ${orderData.signature.substring(0, 20)}...${orderData.signature.slice(-8)}`);
  console.log();
  
  try {
    console.log('📤 Calling validate()...');
    const result = await seaport.validate([order]);
    console.log(`✅ Validation successful! Result:`, result);
  } catch (error: any) {
    console.log('❌ Validation failed:');
    console.log(`   ${error.message}`);
    
    if (error.shortMessage) {
      console.log(`   Short: ${error.shortMessage}`);
    }
    if (error.data) {
      console.log(`   Data: ${error.data}`);
    }
    if (error.reason) {
      console.log(`   Reason: ${error.reason}`);
    }
  }
}

main().catch(console.error);
