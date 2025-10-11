'use client';

import { useState, useEffect } from 'react';
import VaultDelegateInput from './VaultDelegateInput';

interface CartridgeModalV2Props {
  isOpen: boolean;
  onClose: () => void;
  onLoadCartridges: () => void;
  vaultAddress: string;
  onVaultChange: (vault: string) => void;
  playButtonSound?: () => void;
}

const DELEGATION_TOGGLE_KEY = 'mineboy_use_delegation';

export default function CartridgeModalV2({
  isOpen,
  onClose,
  onLoadCartridges,
  vaultAddress,
  onVaultChange,
  playButtonSound = () => {}
}: CartridgeModalV2Props) {
  // Load delegation toggle from localStorage (default: true)
  const [useDelegation, setUseDelegation] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem(DELEGATION_TOGGLE_KEY);
    return saved === null ? true : saved === 'true';
  });

  // Persist toggle state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(DELEGATION_TOGGLE_KEY, String(useDelegation));
    }
  }, [useDelegation]);

  // Clear vault address when delegation is toggled off
  useEffect(() => {
    if (!useDelegation && vaultAddress) {
      onVaultChange('');
    }
  }, [useDelegation, vaultAddress, onVaultChange]);

  if (!isOpen) return null;

  // Now wrapped in DeviceModal, so no outer fixed wrapper needed
  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      border: '3px solid #64ff8a',
      borderRadius: 12,
      padding: 20,
      maxWidth: 400,
      width: '100%',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
      boxSizing: 'border-box'
    }}>
        <h3 style={{ 
          color: '#64ff8a', 
          marginBottom: 16, 
          textAlign: 'center',
          fontFamily: 'Menlo, monospace',
          fontSize: '18px'
        }}>
          Select Cartridge
        </h3>

        {/* Delegation Toggle */}
        <div style={{
          backgroundColor: '#2a2a2a',
          border: '1px solid #444',
          borderRadius: 6,
          padding: 12,
          marginBottom: 16,
        }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            fontFamily: 'Menlo, monospace',
            fontSize: 13,
          }}>
            <span style={{ color: '#c8ffc8' }}>
              🔐 Use Delegation
            </span>
            <div
              onClick={() => {
                playButtonSound();
                setUseDelegation(!useDelegation);
              }}
              style={{
                width: 44,
                height: 24,
                backgroundColor: useDelegation ? '#4a7d5f' : '#555',
                borderRadius: 12,
                position: 'relative',
                transition: 'background-color 0.2s',
                border: `2px solid ${useDelegation ? '#64ff8a' : '#666'}`,
              }}
            >
              <div style={{
                width: 16,
                height: 16,
                backgroundColor: '#fff',
                borderRadius: '50%',
                position: 'absolute',
                top: 2,
                left: useDelegation ? 22 : 2,
                transition: 'left 0.2s',
              }} />
            </div>
          </label>
          <div style={{
            color: '#888',
            fontSize: 10,
            marginTop: 6,
            fontFamily: 'Menlo, monospace',
            lineHeight: 1.4,
          }}>
            {useDelegation 
              ? 'Load NFTs from delegated cold wallet'
              : 'Load NFTs directly from connected wallet'}
          </div>
        </div>

        {/* Delegate/Vault Input - only show when delegation is enabled */}
        {useDelegation && (
          <VaultDelegateInput 
            vaultAddress={vaultAddress}
            onVaultChange={onVaultChange}
            className="mb-4"
            enabled={useDelegation}
          />
        )}

        {/* Load Cartridges Button */}
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => {
              playButtonSound();
              onLoadCartridges();
            }}
            style={{
              width: '100%',
              backgroundColor: '#4a7d5f',
              border: '2px solid #64ff8a',
              borderRadius: 6,
              color: '#64ff8a',
              padding: '12px 16px',
              cursor: 'pointer',
              fontSize: 14,
              fontFamily: 'Menlo, monospace',
              fontWeight: 'bold',
            }}
          >
            🎮 Load My Cartridges
          </button>
        </div>

        {/* Info text */}
        <div style={{
          color: '#888',
          fontSize: '11px',
          textAlign: 'center',
          marginTop: 12,
          fontFamily: 'Menlo, monospace'
        }}>
          Select your NFT cartridge to start mining
        </div>

        {/* Close button */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={() => {
              playButtonSound();
              onClose();
            }}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #555',
              borderRadius: 4,
              color: '#888',
              padding: '6px 16px',
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'Menlo, monospace',
            }}
          >
            Cancel
          </button>
        </div>
    </div>
  );
}

