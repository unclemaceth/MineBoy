import React, { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useSession } from '@/state/useSession';
import { api } from '@/lib/api';
import { contracts, MINING_CLAIM_ROUTER_ABI } from '@/lib/wagmi';

export default function ClaimOverlayV2() {
  const { sessionId, job, lastFound, setFound, pushLine } = useSession();
  const [claiming, setClaiming] = useState(false);
  const [claimData, setClaimData] = useState<unknown>(null);
  
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Handle transaction success
  React.useEffect(() => {
    if (isSuccess) {
      pushLine('Claim successful! Tokens minted.');
      setFound(undefined);
      setClaiming(false);
      setClaimData(null);
    }
  }, [isSuccess, pushLine, setFound]);

  // Handle transaction error
  React.useEffect(() => {
    if (error) {
      pushLine(`Transaction failed: ${error.message}`);
      setClaiming(false);
    }
  }, [error, pushLine]);

  if (!lastFound) return null;

  const handleClaim = async () => {
    if (!sessionId || !job || !lastFound) return;
    
    setClaiming(true);
    pushLine('Submitting solution to backend...');
    
    try {
      // Submit claim to backend
      const result = await api.claim({
        sessionId,
        jobId: job.jobId || job.id,
        preimage: lastFound.preimage,
        hash: lastFound.hash,
        steps: lastFound.attempts,
        hr: lastFound.hr,
      });
      
      if (result.status !== 'accepted') {
        throw new Error('Backend rejected claim');
      }
      
      // Store claim data for transaction
      setClaimData(result);
      pushLine('Backend approved! Submitting to blockchain...');
      
      // Submit transaction to blockchain
      writeContract({
        address: contracts.miningClaimRouter,
        abi: MINING_CLAIM_ROUTER_ABI,
        functionName: 'claim',
        args: [
          result.claimId, // Claim ID
          result.txHash || '0x', // Transaction hash
        ],
      });
      
    } catch (error) {
      pushLine(`Claim failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
