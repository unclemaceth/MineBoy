// packages/backend/src/chain/receiptPoller.ts
import { listPendingWithTx, confirmClaimById, failClaim, expireStalePending } from '../db.js';
import { JsonRpcProvider } from 'ethers';

export function startReceiptPoller(rpcUrl: string) {
  const provider = new JsonRpcProvider(rpcUrl);
  
  // Read config from env with sensible defaults
  const intervalMs = parseInt(process.env.RECEIPT_POLL_INTERVAL_MS || '3600000', 10); // 1 hour default
  const batchLimit = parseInt(process.env.RECEIPT_POLL_BATCH_LIMIT || '500', 10); // 500 per batch
  const runPoller = process.env.RUN_RECEIPT_POLLER !== 'false'; // default true
  
  console.log(`📊 Receipt poller config: RECEIPT_POLL_INTERVAL_MS=${process.env.RECEIPT_POLL_INTERVAL_MS}, computed=${intervalMs}ms`);
  
  if (!runPoller) {
    console.log('📊 Receipt poller disabled via RUN_RECEIPT_POLLER=false');
    return () => {}; // no-op cleanup
  }
  
  console.log(`📊 Receipt poller starting: ${intervalMs}ms interval, ${batchLimit} batch limit`);
  
  // Add jitter to avoid thundering herd if multiple instances
  const jitter = Math.random() * 0.1; // ±10%
  const actualInterval = Math.floor(intervalMs * (1 + jitter));
  
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
  
  // Run immediately on startup, then on interval
  checkPendingReceiptsInBatches();
  
  const handle = setInterval(checkPendingReceiptsInBatches, actualInterval);
  
  console.log(`📊 Receipt poller scheduled: next check in ${Math.round(actualInterval / 1000)}s`);
  
  return () => {
    clearInterval(handle);
    console.log('📊 Receipt poller stopped');
  };
}
