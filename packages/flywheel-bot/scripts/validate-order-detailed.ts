import axios from 'axios';

async function main() {
  console.log('🔍 Detailed Order Validation\n');
  
  const response = await axios.get('https://mineboy-g5xo.onrender.com/market/orders/83');
  const order = response.data.order.order.data;
  
  console.log('📋 Order Structure:');
  console.log(`  Offerer: ${order.offerer}`);
  console.log(`  Zone: ${order.zone}`);
  console.log(`  OrderType: ${order.orderType}`);
  console.log(`  StartTime: ${order.startTime} (${new Date(Number(order.startTime) * 1000).toISOString()})`);
  console.log(`  EndTime: ${order.endTime} (${new Date(Number(order.endTime) * 1000).toISOString()})`);
  console.log(`  ZoneHash: ${order.zoneHash}`);
  console.log(`  Salt: ${order.salt}`);
  console.log(`  ConduitKey: ${order.conduitKey}`);
  console.log(`  Counter: ${order.counter}`);
  console.log();
  
  console.log('📦 Offer Array:');
  order.offer.forEach((item: any, i: number) => {
    console.log(`  [${i}]:`);
    console.log(`    itemType: ${item.itemType} (${item.itemType === 2 ? 'ERC721' : 'UNKNOWN'})`);
    console.log(`    token: ${item.token}`);
    console.log(`    identifierOrCriteria: ${item.identifierOrCriteria}`);
    console.log(`    startAmount: ${item.startAmount}`);
    console.log(`    endAmount: ${item.endAmount}`);
  });
  console.log();
  
  console.log('💰 Consideration Array:');
  let totalNative = 0n;
  order.consideration.forEach((item: any, i: number) => {
    console.log(`  [${i}]:`);
    console.log(`    itemType: ${item.itemType} (${item.itemType === 0 ? 'NATIVE' : 'UNKNOWN'})`);
    console.log(`    token: ${item.token}`);
    console.log(`    identifierOrCriteria: ${item.identifierOrCriteria}`);
    console.log(`    startAmount: ${item.startAmount}`);
    console.log(`    endAmount: ${item.endAmount}`);
    console.log(`    recipient: ${item.recipient}`);
    
    if (item.itemType === 0) {
      totalNative += BigInt(item.endAmount);
    }
  });
  console.log();
  console.log(`  Total Native (APE): ${Number(totalNative) / 1e18} APE`);
  console.log();
  
  console.log('✍️  Signature:');
  console.log(`  ${order.signature.substring(0, 66)}...`);
  console.log(`  Length: ${order.signature.length} chars (${(order.signature.length - 2) / 2} bytes)`);
  console.log();
  
  // Validation checks
  const issues = [];
  
  if (order.offer.length === 0) issues.push('❌ Offer array is empty');
  if (order.consideration.length === 0) issues.push('❌ Consideration array is empty');
  if (totalNative === 0n) issues.push('❌ No native consideration (no payment)');
  if (order.orderType !== 0 && order.orderType !== 2) issues.push(`⚠️  Unusual orderType: ${order.orderType}`);
  if (order.conduitKey !== '0x' + '00'.repeat(32)) issues.push(`⚠️  Non-zero conduitKey`);
  if (order.zone !== '0x' + '00'.repeat(20)) issues.push(`⚠️  Non-zero zone`);
  
  // Check timestamps
  const now = Math.floor(Date.now() / 1000);
  if (Number(order.startTime) > now) issues.push(`❌ Order hasn't started yet (starts in ${Number(order.startTime) - now}s)`);
  if (Number(order.endTime) < now) issues.push(`❌ Order has expired (expired ${now - Number(order.endTime)}s ago)`);
  
  if (issues.length === 0) {
    console.log('✅ No obvious issues found in order structure');
  } else {
    console.log('Issues found:');
    issues.forEach(issue => console.log(`  ${issue}`));
  }
}

main().catch(console.error);
