/**
 * Health Check Script
 * 
 * Run this to get current bot status:
 * npm run health
 * 
 * Or via curl (if you add this as a cron job):
 * node --loader ts-node/esm scripts/health-check.ts
 */

import { getHealthStatus } from '../src/utils/health.js';

async function main() {
  try {
    const status = await getHealthStatus();
    
    console.log('\n═══════════════════════════════════════');
    console.log('        FLYWHEEL BOT HEALTH STATUS');
    console.log('═══════════════════════════════════════\n');
    
    console.log(`🤖 Status: ${status.ok ? '✅ Running' : '🛑 Stopped'}`);
    console.log(`⚠️  Emergency Stop: ${status.emergencyStop ? '🛑 ENABLED' : '✅ Disabled'}`);
    console.log(`🔒 Burn Lock: ${status.burnLock === 'locked' ? '🔐 Locked' : '🔓 Free'}`);
    console.log(`📦 Version: ${status.version}\n`);
    
    console.log('💰 **Balances:**');
    console.log(`   Flywheel: ${status.balances.flywheelAPE} APE`);
    console.log(`   Treasury: ${status.balances.treasuryAPE} APE`);
    console.log(`   Treasury: ${status.balances.treasuryMNESTR} MNESTR\n`);
    
    console.log('📊 **Activity:**');
    console.log(`   Last Buy: ${status.lastBuyAt || 'Never'}`);
    console.log(`   Last List: ${status.lastListAt || 'Never'}`);
    console.log(`   Last Burn: ${status.lastBurnAt || 'Never'}\n`);
    
    console.log('📈 **Counters:**');
    console.log(`   Total Buys: ${status.counters.totalBuys}`);
    console.log(`   Total Burns: ${status.counters.totalBurns}`);
    console.log(`   Swap Failures: ${status.counters.totalSwapFailures}`);
    console.log(`   Buy Failures: ${status.counters.totalBuyFailures}`);
    console.log(`   List Failures: ${status.counters.totalListFailures}\n`);
    
    console.log('═══════════════════════════════════════\n');
    
    // Exit with code 0 if OK, 1 if stopped
    process.exit(status.ok ? 0 : 1);
  } catch (error) {
    console.error('❌ Health check failed:', error);
    process.exit(2);
  }
}

main();
