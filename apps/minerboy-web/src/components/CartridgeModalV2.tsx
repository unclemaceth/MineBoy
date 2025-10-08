'use client';

import VaultDelegateInput from './VaultDelegateInput';

interface CartridgeModalV2Props {
  isOpen: boolean;
  onClose: () => void;
  onLoadCartridges: () => void;
  vaultAddress: string;
  onVaultChange: (vault: string) => void;
  playButtonSound?: () => void;
}

export default function CartridgeModalV2({
  isOpen,
  onClose,
  onLoadCartridges,
  vaultAddress,
  onVaultChange,
  playButtonSound = () => {}
}: CartridgeModalV2Props) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        border: '2px solid #64ff8a',
        borderRadius: 8,
        padding: 20,
        maxWidth: 400,
        width: '90%',
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

        {/* Delegate/Vault Input */}
        <VaultDelegateInput 
          vaultAddress={vaultAddress}
          onVaultChange={onVaultChange}
          className="mb-4"
        />

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
    </div>
  );
}

