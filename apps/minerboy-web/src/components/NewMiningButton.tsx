'use client';
import React from 'react';
import { useMinerSession, type MinerState } from '@/hooks/useMinerSession';

interface NewMiningButtonProps {
  tokenId: number;
  wallet: `0x${string}` | undefined;
  chainId: number | undefined;
  contract: `0x${string}` | undefined;
  onMiningStateChange: (state: MinerState, error?: any) => void;
  className?: string;
}

export function NewMiningButton({ 
  tokenId, 
  wallet, 
  chainId, 
  contract, 
  onMiningStateChange,
  className = ""
}: NewMiningButtonProps) {
  const { state, err, start, stop, sessionId, ownershipTtl } = useMinerSession({
    tokenId,
    wallet,
    chainId,
    contract,
    heartbeatMs: 20000
  });

  // Notify parent of state changes
  React.useEffect(() => {
    onMiningStateChange(state, err);
  }, [state, err, onMiningStateChange]);

  const handleClick = async () => {
    if (state === 'running') {
      await stop();
    } else {
      await start();
    }
  };

  const getButtonText = () => {
    switch (state) {
      case 'idle':
        return 'Start Mining';
      case 'starting':
        return 'Starting...';
      case 'running':
        return 'Stop Mining';
      case 'blocked':
        return 'Blocked';
      case 'expired':
        return 'Resume Mining';
      case 'error':
        return 'Error';
      default:
        return 'Start Mining';
    }
  };

  const getButtonColor = () => {
    switch (state) {
      case 'idle':
      case 'expired':
        return 'bg-green-600 hover:bg-green-700';
      case 'starting':
        return 'bg-yellow-600 hover:bg-yellow-700';
      case 'running':
        return 'bg-red-600 hover:bg-red-700';
      case 'blocked':
      case 'error':
        return 'bg-gray-600 hover:bg-gray-700';
      default:
        return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  const isDisabled = state === 'starting' || state === 'blocked' || !wallet || !chainId || !contract;

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={`px-4 py-2 rounded-lg text-white font-medium transition-colors ${getButtonColor()} ${
          isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${className}`}
      >
        {getButtonText()}
      </button>
      
      {/* Session State Message */}
      {state !== 'idle' && (
        <div className="text-xs text-gray-300">
          {state === 'running' && (
            <span className="text-green-400">✅ Session active (ID: {sessionId.slice(-8)})</span>
          )}
          {state === 'blocked' && err && (
            <div className="text-red-400">
              {err.code === 'cartridge_in_use' && (
                <span>🔒 Cartridge locked for ~{err.remainingMinutes || 'unknown'} minutes</span>
              )}
              {err.code === 'session_still_active' && (
                <span>⚠️ Already mining in another tab</span>
              )}
              {err.code === 'active_session_elsewhere' && (
                <span>⚠️ Another session active</span>
              )}
              {err.code === 'wallet_session_limit_exceeded' && (
                <span>🚫 Max {err.limit || 10} sessions reached ({err.activeCount || 0}/{err.limit || 10})</span>
              )}
              {!['cartridge_in_use', 'session_still_active', 'active_session_elsewhere', 'wallet_session_limit_exceeded'].includes(err.code) && (
                <span>🚫 {err.message || 'Session blocked'}</span>
              )}
            </div>
          )}
          {state === 'expired' && (
            <span className="text-yellow-400">⏰ Session expired - tap to resume</span>
          )}
          {state === 'error' && err && (
            <span className="text-red-400">❌ {err.message || 'Unknown error'}</span>
          )}
        </div>
      )}
      
      {/* Ownership TTL Display */}
      {ownershipTtl && state === 'running' && (
        <div className="text-xs text-blue-400">
          Ownership lock: {Math.ceil(ownershipTtl / 60)} minutes remaining
        </div>
      )}
    </div>
  );
}
