import { flywheel } from '../src/wallets.js';
import { Contract } from 'ethers';
import axios from 'axios';

const SEAPORT = '0x0000000000000068F116a894984e2DB1123eB395';
const BACKEND_URL = 'https://mineboy-g5xo.onrender.com';

async function main() {
  console.log('📋 Fetching order for NPC #83...\n');
  
  const response = await axios.get(`${BACKEND_URL}/market/orders/83`);
  const orderData = response.data.order.order.data;
  
  const now = Math.floor(Date.now() / 1000);
  const startTime = parseInt(orderData.startTime);
  const endTime = parseInt(orderData.endTime);
  
  console.log(`⏰ Timestamp Check:`);
  console.log(`   Current time: ${now} (${new Date(now * 1000).toISOString()})`);
  console.log(`   Order start:  ${startTime} (${new Date(startTime * 1000).toISOString()})`);
  console.log(`   Order end:    ${endTime} (${new Date(endTime * 1000).toISOString()})`);
  console.log();
  
  if (now < startTime) {
    console.log('❌ Order has not started yet!');
    console.log(`   Starts in ${startTime - now} seconds`);
  } else if (now > endTime) {
    console.log('❌ Order has expired!');
    console.log(`   Expired ${now - endTime} seconds ago`);
  } else {
    console.log('✅ Order is active (within valid time range)');
  }
  console.log();
  
  // Try to validate the order on-chain
  console.log('🔍 Attempting on-chain validation...');
  const seaport = new Contract(SEAPORT, [
    'function validate((address,address,(uint8,address,uint256,uint256,uint256)[],(uint8,address,uint256,uint256,uint256,address)[],uint8,uint256,uint256,bytes32,uint256,bytes32,uint256)[] orders) returns (bool)'
  ], flywheel);
  
  try {
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
    
    const tx = await seaport.validate([order]);
    console.log(`✅ Order validated successfully!`);
    console.log(`   Tx hash: ${tx.hash}`);
  } catch (error: any) {
    console.log(`❌ Order validation failed:`);
    console.log(`   ${error.message}`);
  }
}

main().catch(console.error);
