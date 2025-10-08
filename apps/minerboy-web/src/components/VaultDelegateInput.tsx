'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount } from '@/hooks/useActiveAccount';

interface VaultDelegateInputProps {
  vaultAddress: string;
  onVaultChange: (vault: string) => void;
  className?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "https://mineboy-g5xo.onrender.com";
const DELEGATE_ENABLED = process.env.NEXT_PUBLIC_DELEGATE_PHASE1_ENABLED === 'true';

export default function VaultDelegateInput({ vaultAddress, onVaultChange, className = '' }: VaultDelegateInputProps) {
  const { address } = useActiveAccount();
  const [autoDetectedVault, setAutoDetectedVault] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Auto-detect vault on wallet connect
  useEffect(() => {
    if (DELEGATE_ENABLED && address && !vaultAddress) {
      autoDetectVault();
    }
  }, [address]);

  const autoDetectVault = async () => {
    if (!address) return;
    
    setIsDetecting(true);
    try {
      const res = await fetch(`${API_BASE}/v2/delegate/auto-detect?hot=${address}`, {
        credentials: 'include'
      });
      const data = await res.json();
      
      if (data.vault) {
        console.log('[DELEGATE] Auto-detected vault:', data.vault);
        setAutoDetectedVault(data.vault);
        onVaultChange(data.vault);
      } else {
        console.log('[DELEGATE] No vault delegation found');
      }
    } catch (error) {
      console.error('[DELEGATE] Auto-detect error:', error);
    } finally {
      setIsDetecting(false);
    }
  };

  // Don't render if feature disabled
  if (!DELEGATE_ENABLED) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Toggle Advanced Settings */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-xs text-zinc-400 hover:text-zinc-300 flex items-center gap-2"
      >
        <span>{showAdvanced ? '▼' : '▶'}</span>
        <span>Advanced: Delegate from Cold Wallet</span>
      </button>

      {/* Vault Input (collapsed by default) */}
      {showAdvanced && (
        <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-700 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-white mb-1">
                🔐 Cold Wallet Delegation
              </h4>
              <p className="text-xs text-zinc-400">
                Keep your NFTs safe in cold storage while mining from this hot wallet
              </p>
            </div>
            
            {isDetecting && (
              <div className="text-xs text-blue-400 animate-pulse">
                Detecting...
              </div>
            )}
          </div>

          {/* Auto-detected vault message */}
          {autoDetectedVault && (
            <div className="text-xs p-2 rounded bg-green-500/10 border border-green-500/20 text-green-400">
              ✅ Vault detected: {autoDetectedVault.slice(0, 6)}...{autoDetectedVault.slice(-4)}
            </div>
          )}

          {/* Vault address input */}
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">
              Vault Address (optional)
            </label>
            <input
              type="text"
              placeholder="0x... (leave blank for direct ownership)"
              value={vaultAddress}
              onChange={(e) => onVaultChange(e.target.value.trim())}
              className="w-full px-3 py-2 text-sm bg-black border border-zinc-600 rounded-lg text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-green-500"
            />
          </div>

          {/* Delegation setup link */}
          <div className="flex items-center justify-between text-xs">
            <a 
              href="https://delegate.xyz" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-green-400 hover:text-green-300 flex items-center gap-1"
            >
              <span>Set up delegation</span>
              <span>→</span>
            </a>
            
            <button
              onClick={autoDetectVault}
              disabled={isDetecting || !address}
              className="text-blue-400 hover:text-blue-300 disabled:text-zinc-600 disabled:cursor-not-allowed"
            >
              {isDetecting ? 'Detecting...' : 'Re-detect vault'}
            </button>
          </div>

          {/* Info box */}
          <div className="text-xs p-2 rounded bg-zinc-800/50 border border-zinc-700 text-zinc-400 space-y-1">
            <p><strong className="text-white">How it works:</strong></p>
            <ul className="list-disc list-inside space-y-0.5 ml-2">
              <li>Set up delegation at delegate.xyz (vault → this wallet)</li>
              <li>Enter your vault address above</li>
              <li>Mine with this hot wallet</li>
              <li>Rewards mint to your vault (cold storage)</li>
              <li>Multipliers check vault's NFT holdings</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

