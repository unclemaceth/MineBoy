import { flywheel } from '../src/wallets.js';
import { verifyTypedData } from 'ethers';
import axios from 'axios';

async function main() {
  console.log('🔍 Verifying order signature...\n');
  
  // Fetch the stored order
  const response = await axios.get('https://mineboy-g5xo.onrender.com/market/orders/83');
  const orderData = response.data.order.order.data;
  
  const domain = orderData.domain;
  const types = {
    OrderComponents: [
      { name: 'offerer', type: 'address' },
      { name: 'zone', type: 'address' },
      { name: 'offer', type: 'OfferItem[]' },
      { name: 'consideration', type: 'ConsiderationItem[]' },
      { name: 'orderType', type: 'uint8' },
      { name: 'startTime', type: 'uint256' },
      { name: 'endTime', type: 'uint256' },
      { name: 'zoneHash', type: 'bytes32' },
      { name: 'salt', type: 'uint256' },
      { name: 'conduitKey', type: 'bytes32' },
      { name: 'counter', type: 'uint256' },
    ],
    OfferItem: [
      { name: 'itemType', type: 'uint8' },
      { name: 'token', type: 'address' },
      { name: 'identifierOrCriteria', type: 'uint256' },
      { name: 'startAmount', type: 'uint256' },
      { name: 'endAmount', type: 'uint256' },
    ],
    ConsiderationItem: [
      { name: 'itemType', type: 'uint8' },
      { name: 'token', type: 'address' },
      { name: 'identifierOrCriteria', type: 'uint256' },
      { name: 'startAmount', type: 'uint256' },
      { name: 'endAmount', type: 'uint256' },
      { name: 'recipient', type: 'address' },
    ],
  };
  
  const value = {
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
    counter: orderData.counter,
  };
  
  const signature = orderData.signature;
  const flywheelAddr = await flywheel.getAddress();
  
  try {
    const recoveredAddress = verifyTypedData(domain, types, value, signature);
    
    console.log(`Flywheel address: ${flywheelAddr}`);
    console.log(`Recovered signer:  ${recoveredAddress}`);
    console.log(`Signature: ${signature.substring(0, 20)}...${signature.substring(signature.length - 8)}`);
    console.log();
    
    if (recoveredAddress.toLowerCase() === flywheelAddr.toLowerCase()) {
      console.log('✅ Signature is VALID!');
    } else {
      console.log('❌ Signature is INVALID!');
      console.log(`   Expected: ${flywheelAddr}`);
      console.log(`   Got:      ${recoveredAddress}`);
    }
  } catch (error: any) {
    console.log('❌ Failed to verify signature:');
    console.log(`   ${error.message}`);
  }
}

main().catch(console.error);
