import React, { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { useSession } from '@/state/useSession';
import { api } from '@/lib/api';
import { contracts, MINING_CLAIM_ROUTER_ABI } from '@/lib/contracts';
import { to0x } from '@/lib/hex';
import { getJobId, assertString } from '@/utils/job';

export default function ClaimOverlayV2() {
  const { sessionId, job, lastFound, setFound, pushLine } = useSession();
  const { address } = useAccount();
  const [claiming, setClaiming] = useState(false);
  const [claimData, setClaimData] = useState<unknown>(null);
  
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Handle transaction success with retry
  React.useEffect(() => {
    if (isSuccess && hash && claimData) {
      const claimId = (claimData as any).claimId;
      let cancelled = false;

      const submit = async (attempt = 0) => {
        try {
          await api.claimTx({ claimId, txHash: hash });
          pushLine('Transaction hash submitted to backend');
        } catch (e) {
          if (cancelled) return;
          const backoff = Math.min(30_000, 1000 * Math.pow(2, attempt)); // up to 30s
          console.warn(`Failed to submit tx hash (attempt ${attempt + 1}), retrying in ${backoff}ms:`, e);
          setTimeout(() => submit(attempt + 1), backoff);
        }
      };

      submit();
      
      pushLine('Claim successful! Tokens minted.');
      setFound(undefined);
      setClaiming(false);
      setClaimData(null);

      return () => { cancelled = true; };
    }
  }, [isSuccess, hash, claimData, pushLine, setFound]);

  // Handle transaction error
  React.useEffect(() => {
    if (error) {
      pushLine(`Transaction failed: ${error.message}`);
      setClaiming(false);
    }
  }, [error, pushLine]);

  if (!lastFound) return null;

  const handleClaim = async () => {
    if (!sessionId || !job || !lastFound || !address) return;
    
    const jobId = getJobId(job);
    if (!jobId) {
      pushLine('Invalid job - missing job ID');
      return;
    }
    
    setClaiming(true);
    pushLine('Submitting solution to backend...');
    
    try {
      // Submit claim to backend
      const result = await api.claimV2({
        sessionId,
        jobId,
        preimage: lastFound.preimage,
        hash: to0x(lastFound.hash),
        steps: lastFound.attempts,
        hr: lastFound.hr,
        minerId: to0x(address),
      });
      
      if (result.status !== 'accepted') {
        throw new Error('Backend rejected claim');
      }
      
      // Store claim data for transaction
      setClaimData(result);
      pushLine('Backend approved! Submitting to blockchain...');
      
      // Submit transaction to blockchain
      if (!result.claim || !result.signature) {
        throw new Error('Missing claim data or signature');
      }
      
      const routerAddress = (process.env.NEXT_PUBLIC_ROUTER_ADDRESS || contracts.miningClaimRouter) as `0x${string}`;
      console.log('[CLAIM_DEBUG] Router address:', routerAddress);
      console.log('[CLAIM_DEBUG] Env var:', process.env.NEXT_PUBLIC_ROUTER_ADDRESS);
      console.log('[CLAIM_DEBUG] Fallback:', contracts.miningClaimRouter);
      
      writeContract({
        address: routerAddress,
        abi: [
          {
            name: 'claimV2',
            type: 'function',
            stateMutability: 'payable',
            inputs: [
              { name: 'claimData', type: 'tuple', components: [
                { name: 'wallet', type: 'address' },
                { name: 'cartridge', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
                { name: 'rewardToken', type: 'address' },
                { name: 'workHash', type: 'bytes32' },
                { name: 'attempts', type: 'uint64' },
                { name: 'nonce', type: 'bytes32' },
                { name: 'expiry', type: 'uint64' }
              ]},
              { name: 'signature', type: 'bytes' }
            ],
            outputs: []
          }
        ],
        functionName: 'claimV2',
        args: [
          {
            wallet: to0x(result.claim.wallet),
            cartridge: to0x(result.claim.cartridge),
            tokenId: BigInt(result.claim.tokenId),
            rewardToken: to0x(result.claim.rewardToken),
            workHash: to0x(result.claim.workHash),
            attempts: BigInt(result.claim.attempts),
            nonce: to0x(result.claim.nonce),
            expiry: BigInt(result.claim.expiry)
          },
          to0x(result.signature)
        ],
        value: BigInt('1000000000000000'), // 0.001 ETH (0.001 APE)
      });
      
    } catch (error) {
      console.error('[CLAIM_ERROR]', error);
      console.error('[CLAIM_ERROR_DETAILS]', {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Try to extract revert reason if it's a contract error
      let errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('execution reverted:')) {
        const revertReason = errorMessage.split('execution reverted:')[1]?.trim();
        errorMessage = `Contract reverted: ${revertReason}`;
      }
      
      pushLine(`Claim failed: ${errorMessage}`);
      setClaiming(false);
    }
  };

  const handleDismiss = () => {
    setFound(undefined);
    pushLine('Claim dismissed');
  };

  const isProcessing = claiming || isPending || isConfirming;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        border: '2px solid #64ff8a',
        borderRadius: 8,
        padding: 24,
        maxWidth: 320,
        width: '90%',
        color: '#64ff8a',
        fontFamily: 'Menlo, monospace',
        textAlign: 'center',
        boxShadow: '0 0 20px rgba(100, 255, 138, 0.5)',
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18 }}>
          Hash Found!
        </h3>
        
        <div style={{ 
          fontSize: 11, 
          wordBreak: 'break-all', 
          marginBottom: 16,
          opacity: 0.8,
          backgroundColor: 'rgba(100, 255, 138, 0.1)',
          padding: 8,
          borderRadius: 4,
        }}>
          {lastFound.hash}
        </div>
        
        <div style={{ 
          fontSize: 12, 
          marginBottom: 20,
          opacity: 0.9,
        }}>
          <div>Attempts: {lastFound.attempts.toLocaleString()}</div>
          <div>Hash Rate: {lastFound.hr.toLocaleString()} H/s</div>
        </div>
        
        {isProcessing && (
          <div style={{ 
            marginBottom: 16, 
            fontSize: 12,
            opacity: 0.8,
          }}>
            {claiming && !hash && 'Submitting to backend...'}
            {isPending && 'Waiting for wallet confirmation...'}
            {isConfirming && 'Confirming transaction...'}
          </div>
        )}
        
        <div style={{ 
          display: 'flex', 
          gap: 12, 
          justifyContent: 'center',
        }}>
          <button
            onClick={handleClaim}
            disabled={isProcessing}
            style={{
              backgroundColor: isProcessing ? '#333' : '#64ff8a',
              color: isProcessing ? '#666' : '#000',
              border: 'none',
              padding: '10px 20px',
              borderRadius: 4,
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: 14,
              fontFamily: 'Menlo, monospace',
            }}
          >
            {isProcessing ? 'Processing...' : 'Claim Reward'}
          </button>
          
          <button
            onClick={handleDismiss}
            disabled={isProcessing}
            style={{
              backgroundColor: '#333',
              color: isProcessing ? '#666' : '#fff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: 4,
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontFamily: 'Menlo, monospace',
            }}
          >
            Dismiss
          </button>
        </div>
        
        {hash && (
          <div style={{ 
            marginTop: 16, 
            fontSize: 10, 
            opacity: 0.6,
            wordBreak: 'break-all',
          }}>
            Tx: {hash}
          </div>
        )}
      </div>
    </div>
  );
}
