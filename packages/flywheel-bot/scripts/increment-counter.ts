/**
 * Increment the Seaport counter to cancel ALL previous orders
 * This invalidates any old Magic Eden listings that might be conflicting
 */
import { flywheel } from '../src/wallets.js';
import { Contract } from 'ethers';

const SEAPORT = '0x0000000000000068F116a894984e2DB1123eB395';

async function main() {
  console.log('🔄 Incrementing Seaport counter to cancel all previous orders...\n');
  
  const seaport = new Contract(
    SEAPORT,
    [
      'function getCounter(address) view returns (uint256)',
      'function incrementCounter() returns (uint256)'
    ],
    flywheel
  );
  
  const flywheelAddr = await flywheel.getAddress();
  
  // Check current counter
  const counterBefore = await seaport.getCounter(flywheelAddr);
  console.log(`Current counter: ${counterBefore.toString()}`);
  console.log(`Wallet: ${flywheelAddr}`);
  console.log();
  
  console.log('📤 Sending incrementCounter transaction...');
  const tx = await seaport.incrementCounter();
  console.log(`Transaction sent: ${tx.hash}`);
  
  console.log('⏳ Waiting for confirmation...');
  await tx.wait();
  
  // Check new counter
  const counterAfter = await seaport.getCounter(flywheelAddr);
  console.log(`\n✅ Counter incremented!`);
  console.log(`   Old counter: ${counterBefore.toString()}`);
  console.log(`   New counter: ${counterAfter.toString()}`);
  console.log();
  console.log('🎉 All previous orders are now cancelled!');
  console.log('   You must relist the NPCs with the new counter.');
}

main().catch(console.error);
