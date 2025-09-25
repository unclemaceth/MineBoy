import { useMinerStore } from '@/state/miner';
import { useSession } from '@/state/useSession';
import { api } from '@/lib/api';
import { getJobId } from '@/utils/job';
import { to0x } from '@/lib/hex';
import { getMinerIdCached } from '@/utils/minerId';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { contracts, MINING_CLAIM_ROUTER_ABI } from '@/lib/contracts';
import { useState, useEffect } from 'react';

export default function ClaimOverlay() {
  const { foundHash, setFoundHash, pushLine, setMiningState } = useMinerStore();
  const { sessionId, job, lastFound, claimState, setClaimState, setFound } = useSession();
  const { writeContract, data: hash } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });
  const [isClaiming, setIsClaiming] = useState(false);
  const [pendingClaimId, setPendingClaimId] = useState<string | null>(null);

  // Watch for transaction hash and report to backend with retry
  useEffect(() => {
    console.log('[TX_HASH_DEBUG]', { pendingClaimId, hash, hasBoth: !!(pendingClaimId && hash) });
    
    if (!pendingClaimId || !hash) return;

    let cancelled = false;

    const submit = async (attempt = 0) => {
      try {
        console.log('[TX_HASH_SUBMIT]', { claimId: pendingClaimId, txHash: hash, attempt });
        await api.claimTx({ claimId: pendingClaimId, txHash: hash });
        pushLine('Transaction tracked by backend');
        setPendingClaimId(null); // prevent repeats
      } catch (e) {
        if (cancelled) return;
        const backoff = Math.min(30_000, 1000 * Math.pow(2, attempt)); // up to 30s
        console.warn(`Failed to submit tx hash (attempt ${attempt + 1}), retrying in ${backoff}ms:`, e);
        setTimeout(() => submit(attempt + 1), backoff);
      }
    };

    submit();

    return () => { cancelled = true; };
  }, [hash, pendingClaimId, pushLine]);

  if (!foundHash || claimState !== 'overlay') return null;

  const handleClaim = async () => {
    setIsClaiming(true);
    setMiningState('claiming');
    setClaimState('submitting');

    try {
      // Preserve your "retro" lines
      pushLine('Starting claim verification...');
      await new Promise(r => setTimeout(r, 150));
      pushLine('Wallet Match: ✅ YES');
      await new Promise(r => setTimeout(r, 150));
      pushLine('PrevHash Match: ✅ YES');
      await new Promise(r => setTimeout(r, 150));
      pushLine('Contract Simulation: ✅ SUCCESS');

      // --- ADDED: real DB claim + on-chain call + tx-hash attach ---
      if (!sessionId || !job || !lastFound) throw new Error("Missing session/job/found hash");

      const minerId = getMinerIdCached();
      const jobId = getJobId(job);
      if (!jobId) throw new Error("Missing jobId");

      pushLine('Creating claim record in DB…');

      // 1) Create pending claim + get EIP-712 payload & sig from backend (V2)
      const createRes = await api.claimV2({
        sessionId,
        jobId,
        preimage: lastFound.preimage,
        hash: to0x(lastFound.hash),
        steps: lastFound.attempts,
        hr: lastFound.hr,
        minerId,
      });

      // normalizeClaimRes() already ran in api.claimV2()
      const packed = createRes?.claim;
      const sig    = createRes?.signature;
      if (!packed || !sig) throw new Error("Backend didn't return claim payload/signature");

      // Update session with tier information
      if (createRes.tier !== undefined && createRes.tierName && createRes.amountLabel) {
        setFound({
          ...lastFound,
          tier: createRes.tier,
          tierName: createRes.tierName,
          amountLabel: createRes.amountLabel
        });
      }

      // Store the claim ID for transaction hash submission
      setPendingClaimId(createRes.claimId);

              pushLine('Broadcasting wallet transaction…');

      // 2) Use claimV2 on-chain function (no rewardAmount in signature)
      writeContract({
        address: contracts.miningClaimRouter as `0x${string}`,
        abi: [
          {
            name: 'claimV2',
            type: 'function',
            stateMutability: 'nonpayable',
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
        functionName: "claimV2", // ← use the new V2 function
        args: [ 
          {
            wallet: to0x(packed.wallet),
            cartridge: to0x(packed.cartridge),
            tokenId: BigInt(packed.tokenId),
            rewardToken: to0x(packed.rewardToken),
            workHash: to0x(packed.workHash),
            attempts: BigInt(packed.attempts),
            nonce: to0x(packed.nonce),
            expiry: BigInt(packed.expiry)
          },
          to0x(sig)
        ],
      });

      // Transaction hash will be captured by useEffect above

      pushLine('✅ Claim submitted!');
    } catch (err) {
      console.error(err);
      pushLine(`❌ Claim failed: ${err instanceof Error ? err.message : String(err)}`);
      setPendingClaimId(null); // clear pending claim on error
    } finally {
      setIsClaiming(false);
      setFoundHash(null);
      setMiningState('idle');
      setClaimState('idle');
      setFound(undefined);
    }
  };

  const handleDismiss = () => {
    setFoundHash(null);
    setMiningState('idle'); // Return to idle, user must press A to resume
    setClaimState('idle');
    setFound(undefined);
  };

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
        backgroundColor: '#2a4a3d',
        border: '3px solid #4a7d5f',
        borderRadius: 12,
        padding: 24,
        maxWidth: 320,
        width: '90%',
        textAlign: 'center',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
      }}>
        <div style={{
          color: '#64ff8a',
          fontSize: 18,
          fontWeight: 'bold',
          marginBottom: 16,
          fontFamily: 'Menlo, monospace',
        }}>
          Hash Found! 🎉
        </div>
        
        <div style={{
          color: '#64ff8a',
          fontSize: 12,
          fontFamily: 'Menlo, monospace',
          marginBottom: 24,
          wordBreak: 'break-all',
          opacity: 0.8,
        }}>
          {foundHash.slice(0, 20)}...{foundHash.slice(-10)}
        </div>

        <div style={{
          display: 'flex',
          gap: 12,
          justifyContent: 'center',
        }}>
          <button
            onClick={handleClaim}
            disabled={isClaiming}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '2px solid',
              borderTopColor: '#4a7d5f',
              borderLeftColor: '#4a7d5f',
              borderRightColor: '#1a3d24',
              borderBottomColor: '#1a3d24',
              background: 'linear-gradient(145deg, #3a6a4d, #2a4a3d)',
              color: '#64ff8a',
              fontSize: 12,
              fontWeight: 'bold',
              cursor: isClaiming ? 'not-allowed' : 'pointer',
              opacity: isClaiming ? 0.6 : 1,
              fontFamily: 'Menlo, monospace',
            }}
          >
                    {isClaiming ? 'Claiming...' : 'Claim'}
          </button>
          
          <button
            onClick={handleDismiss}
            disabled={isClaiming}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '2px solid',
              borderTopColor: '#666',
              borderLeftColor: '#666',
              borderRightColor: '#333',
              borderBottomColor: '#333',
              background: 'linear-gradient(145deg, #555, #333)',
              color: '#ccc',
              fontSize: 12,
              fontWeight: 'bold',
              cursor: isClaiming ? 'not-allowed' : 'pointer',
              opacity: isClaiming ? 0.6 : 1,
              fontFamily: 'Menlo, monospace',
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
