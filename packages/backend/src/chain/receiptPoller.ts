// packages/backend/src/chain/receiptPoller.ts
import { listPendingWithTx, confirmClaimById, failClaim, expireStalePending } from '../db.js';
import { JsonRpcProvider } from 'ethers';

export function startReceiptPoller(rpcUrl: string) {
  const provider = new JsonRpcProvider(rpcUrl);
  
  // Read config from env with sensible defaults
  const intervalMs = parseInt(process.env.RECEIPT_POLL_INTERVAL_MS || '600000', 10); // 10 minutes default
  const batchLimit = parseInt(process.env.RECEIPT_POLL_BATCH_LIMIT || '500', 10); // 500 per batch
  const runPoller = process.env.RUN_RECEIPT_POLLER !== 'false'; // default true
  
  console.log(`📊 Receipt poller config: RECEIPT_POLL_INTERVAL_MS=${process.env.RECEIPT_POLL_INTERVAL_MS}, computed=${intervalMs}ms`);
  
  if (!runPoller) {
    console.log('📊 Receipt poller disabled via RUN_RECEIPT_POLLER=false');
    return () => {}; // no-op cleanup
  }
  
  console.log(`📊 Receipt poller starting: ${intervalMs}ms interval, ${batchLimit} batch limit`);
  
  const checkPendingReceiptsInBatches = async () => {
    const now = Date.now();
    
    try {
      // Expire old pending claims (24h+ old)
      expireStalePending(now - 24 * 60 * 60 * 1000);
      
      // Get pending claims with tx_hash, ordered by updated_at
      const rows = listPendingWithTx();
      if (!rows.length) {
        console.log('📊 No pending claims to check');
        return;
      }
      
      console.log(`📊 Checking ${rows.length} pending claims (batch limit: ${batchLimit})`);
      
      // Process in batches to avoid overwhelming RPC
      const batches = [];
      for (let i = 0; i < rows.length; i += batchLimit) {
        batches.push(rows.slice(i, i + batchLimit));
      }
      
      let confirmed = 0;
      let failed = 0;
      
      for (const batch of batches) {
        for (const row of batch) {
          try {
            const receipt = await provider.getTransactionReceipt(row.tx_hash!);
            if (!receipt) {
              // Still pending, leave as-is
              continue;
            }
            
            if (receipt.status === 1n || receipt.status === 1) {
              confirmClaimById(row.id, row.tx_hash!, now);
              confirmed++;
            } else {
              failClaim(row.id);
              failed++;
            }
          } catch (error) {
            // Ignore transient RPC errors, but log for debugging
            console.warn(`📊 RPC error checking tx ${row.tx_hash}:`, error);
          }
        }
        
        // Small delay between batches to be nice to RPC
        if (batches.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      if (confirmed > 0 || failed > 0) {
        console.log(`📊 Receipt check complete: ${confirmed} confirmed, ${failed} failed`);
      }
      
    } catch (error) {
      console.error('📊 Receipt poller error:', error);
    }
  };
  
  // Calculate next exact 10-minute mark
  const getNextExactInterval = () => {
    const now = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const milliseconds = now.getMilliseconds();
    
    // Round up to next 10-minute mark
    const nextMinute = Math.ceil(minutes / 10) * 10;
    const nextTime = new Date(now);
    
    if (nextMinute >= 60) {
      nextTime.setHours(nextTime.getHours() + 1);
      nextTime.setMinutes(0);
    } else {
      nextTime.setMinutes(nextMinute);
    }
    nextTime.setSeconds(0);
    nextTime.setMilliseconds(0);
    
    const delay = nextTime.getTime() - now.getTime();
    return delay;
  };
  
  // Run immediately on startup
  checkPendingReceiptsInBatches();
  
  // Schedule first run at exact 10-minute mark
  const firstDelay = getNextExactInterval();
  console.log(`📊 Receipt poller scheduled: first check in ${Math.round(firstDelay / 1000)}s (at exact 10-minute mark)`);
  
  const firstTimeout = setTimeout(() => {
    checkPendingReceiptsInBatches();
    
    // Then run every 10 minutes exactly
    const handle = setInterval(checkPendingReceiptsInBatches, intervalMs);
    console.log(`📊 Receipt poller now running every ${intervalMs / 1000}s exactly`);
    
    // Store handle for cleanup
    (firstTimeout as any).intervalHandle = handle;
  }, firstDelay);
  
  return () => {
    clearTimeout(firstTimeout);
    if ((firstTimeout as any).intervalHandle) {
      clearInterval((firstTimeout as any).intervalHandle);
    }
    console.log('📊 Receipt poller stopped');
  };
}
