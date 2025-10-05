'use client';

import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, keccak256, toBytes } from 'viem';
import { useActiveAccount } from '@/hooks/useActiveAccount';
import { playButtonSound, playConfirmSound, playFailSound } from '@/lib/sounds';
import PaidMessagesRouterABI from '@/abi/PaidMessagesRouter.json';

interface PaidMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROUTER_ADDRESS = (process.env.NEXT_PUBLIC_PAID_MESSAGES_ROUTER || '') as `0x${string}`;
const MESSAGE_COST = '1'; // 1 APE

export default function PaidMessageModal({ isOpen, onClose }: PaidMessageModalProps) {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'confirming' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const { address } = useActiveAccount();
  
  const { writeContract, data: txHash, error: txError } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });
  
  const submitMessageToBackend = async (hash: `0x${string}`) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/v2/messages/paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          txHash: hash,
          wallet: address,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit message');
      }
      
      setStatus('success');
      playConfirmSound();
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        handleClose();
      }, 2000);
      
    } catch (error: any) {
      console.error('Failed to submit message:', error);
      setStatus('error');
      setErrorMessage(error.message || 'Failed to submit message');
      playFailSound();
    }
  };
  
  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed && status === 'confirming' && txHash) {
      setStatus('submitting');
      submitMessageToBackend(txHash);
    }
  }, [isConfirmed, status, txHash]);
  
  const handleSubmit = () => {
    if (!message.trim()) {
      setErrorMessage('Message cannot be empty');
      playFailSound();
      return;
    }
    
    if (message.length > 64) {
      setErrorMessage('Message must be 64 characters or less');
      playFailSound();
      return;
    }
    
    if (!address) {
      setErrorMessage('Please connect your wallet');
      playFailSound();
      return;
    }
    
    if (!ROUTER_ADDRESS) {
      setErrorMessage('Router contract not configured');
      playFailSound();
      return;
    }
    
    setStatus('sending');
    setErrorMessage('');
    playButtonSound();
    
    try {
      // Calculate message hash (same as backend will verify)
      const msgHash = keccak256(toBytes(message.trim()));
      
      // Call router contract's pay() function
      writeContract({
        address: ROUTER_ADDRESS,
        abi: PaidMessagesRouterABI,
        functionName: 'pay',
        args: [msgHash],
        value: parseEther(MESSAGE_COST),
      });
      
      // Status will be updated to 'confirming' once txHash is available
      setStatus('confirming');
      
    } catch (error: any) {
      console.error('Transaction failed:', error);
      setStatus('error');
      setErrorMessage(error.message || 'Transaction failed');
      playFailSound();
    }
  };
  
  const handleClose = () => {
    playButtonSound();
    setMessage('');
    setStatus('idle');
    setErrorMessage('');
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '20px',
    }}>
      <div style={{
        backgroundColor: '#1a3d24',
        border: '3px solid #4a7d5f',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '400px',
        width: '100%',
        fontFamily: 'Menlo, monospace',
        color: '#c8ffc8',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          borderBottom: '2px solid #4a7d5f',
          paddingBottom: '12px',
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '18px',
            color: '#64ff8a',
            fontWeight: 'bold',
          }}>
            💎 PAID MESSAGE
          </h2>
          <button
            onClick={handleClose}
            disabled={status === 'sending' || status === 'confirming' || status === 'submitting'}
            style={{
              background: 'linear-gradient(145deg, #ff6b6b, #d63031)',
              color: 'white',
              border: '2px solid #8a8a8a',
              borderRadius: '6px',
              width: '30px',
              height: '30px',
              cursor: status === 'sending' || status === 'confirming' || status === 'submitting' ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              opacity: status === 'sending' || status === 'confirming' || status === 'submitting' ? 0.5 : 1,
            }}
          >
            ×
          </button>
        </div>
        
        {/* Instructions */}
        <div style={{
          marginBottom: '16px',
          fontSize: '12px',
          lineHeight: '1.6',
          color: '#8fbc8f',
        }}>
          <p style={{ margin: '0 0 8px 0' }}>
            Post your message to the scrolling banner for <strong>1 hour</strong>!
          </p>
          <p style={{ margin: '0 0 8px 0' }}>
            <strong>Cost:</strong> {MESSAGE_COST} APE
          </p>
          <p style={{ margin: '0', fontSize: '11px', color: '#666' }}>
            Max 64 characters • Auto-moderated
          </p>
        </div>
        
        {/* Message Input */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#64ff8a',
          }}>
            Your Message:
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={64}
            disabled={status !== 'idle' && status !== 'error'}
            placeholder="Type your message here..."
            style={{
              width: '100%',
              minHeight: '80px',
              padding: '12px',
              backgroundColor: '#0f2216',
              border: '2px solid #4a7d5f',
              borderRadius: '6px',
              color: '#c8ffc8',
              fontSize: '14px',
              fontFamily: 'Menlo, monospace',
              resize: 'vertical',
              opacity: status !== 'idle' && status !== 'error' ? 0.5 : 1,
            }}
          />
          <div style={{
            marginTop: '4px',
            fontSize: '11px',
            color: message.length > 64 ? '#ff6b6b' : '#666',
            textAlign: 'right',
          }}>
            {message.length} / 64
          </div>
        </div>
        
        {/* Status Messages */}
        {status === 'sending' && (
          <div style={{
            padding: '12px',
            backgroundColor: 'rgba(100, 255, 138, 0.1)',
            border: '1px solid #64ff8a',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '12px',
            color: '#64ff8a',
          }}>
            📤 Sending transaction...
          </div>
        )}
        
        {status === 'confirming' && (
          <div style={{
            padding: '12px',
            backgroundColor: 'rgba(100, 255, 138, 0.1)',
            border: '1px solid #64ff8a',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '12px',
            color: '#64ff8a',
          }}>
            ⏳ Waiting for confirmation...
          </div>
        )}
        
        {status === 'submitting' && (
          <div style={{
            padding: '12px',
            backgroundColor: 'rgba(100, 255, 138, 0.1)',
            border: '1px solid #64ff8a',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '12px',
            color: '#64ff8a',
          }}>
            📝 Submitting message...
          </div>
        )}
        
        {status === 'success' && (
          <div style={{
            padding: '12px',
            backgroundColor: 'rgba(100, 255, 138, 0.2)',
            border: '1px solid #64ff8a',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '12px',
            color: '#64ff8a',
            fontWeight: 'bold',
          }}>
            ✅ Message posted successfully!
          </div>
        )}
        
        {status === 'error' && errorMessage && (
          <div style={{
            padding: '12px',
            backgroundColor: 'rgba(255, 107, 107, 0.1)',
            border: '1px solid #ff6b6b',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '12px',
            color: '#ff6b6b',
          }}>
            ❌ {errorMessage}
          </div>
        )}
        
        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={status !== 'idle' && status !== 'error'}
          style={{
            width: '100%',
            padding: '12px',
            background: status !== 'idle' && status !== 'error' 
              ? 'linear-gradient(145deg, #333, #1a1a1a)'
              : 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
            color: status !== 'idle' && status !== 'error' ? '#666' : '#c8ffc8',
            border: '2px solid #4a7d5f',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: status !== 'idle' && status !== 'error' ? 'not-allowed' : 'pointer',
            opacity: status !== 'idle' && status !== 'error' ? 0.5 : 1,
          }}
        >
          {status === 'idle' || status === 'error' ? `PAY ${MESSAGE_COST} APE & POST` : 'PROCESSING...'}
        </button>
      </div>
    </div>
  );
}
