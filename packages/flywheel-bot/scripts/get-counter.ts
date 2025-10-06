import { flywheel } from '../src/wallets.js';
import { Contract } from 'ethers';

const SEAPORT = '0x0000000000000068F116a894984e2DB1123eB395';

async function main() {
  const seaport = new Contract(
    SEAPORT,
    ['function getCounter(address) view returns (uint256)'],
    flywheel
  );
  
  const flywheelAddr = await flywheel.getAddress();
  const counter = await seaport.getCounter(flywheelAddr);
  
  console.log(`\n📊 Seaport Counter Check:`);
  console.log(`   Wallet: ${flywheelAddr}`);
  console.log(`   Counter: ${counter.toString()}\n`);
}

main().catch(console.error);
