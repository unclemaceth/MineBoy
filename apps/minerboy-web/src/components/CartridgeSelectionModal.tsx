'use client';
import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { getOwnedCartridges, getCartridgeMetadata, type OwnedCartridge } from '@/lib/alchemy';

interface CartridgeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCartridge: (cartridge: OwnedCartridge) => void;
}

export default function CartridgeSelectionModal({ 
  isOpen, 
  onClose, 
  onSelectCartridge 
}: CartridgeSelectionModalProps) {
  const { address } = useAccount();
  const [ownedCartridges, setOwnedCartridges] = useState<OwnedCartridge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && address) {
      loadOwnedCartridges();
    }
  }, [isOpen, address]);

  const loadOwnedCartridges = async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const cartridges = await getOwnedCartridges(address);
      setOwnedCartridges(cartridges);
    } catch (err) {
      setError('Failed to load cartridges');
      console.error('Error loading cartridges:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

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
        maxWidth: 400,
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
      }}>
        <div style={{
          color: '#64ff8a',
          fontSize: 18,
          fontWeight: 'bold',
          marginBottom: 16,
          fontFamily: 'Menlo, monospace',
          textAlign: 'center',
        }}>
          SELECT CARTRIDGE
        </div>

        {loading && (
          <div style={{
            color: '#64ff8a',
            fontSize: 14,
            fontFamily: 'Menlo, monospace',
            textAlign: 'center',
            padding: 20,
          }}>
            Loading your cartridges...
          </div>
        )}

        {error && (
          <div style={{
            color: '#ff6b6b',
            fontSize: 14,
            fontFamily: 'Menlo, monospace',
            textAlign: 'center',
            padding: 20,
          }}>
            {error}
          </div>
        )}

        {!loading && !error && ownedCartridges.length === 0 && (
          <div style={{
            color: '#64ff8a',
            fontSize: 14,
            fontFamily: 'Menlo, monospace',
            textAlign: 'center',
            padding: 20,
          }}>
            No cartridges found in your wallet
          </div>
        )}

        {!loading && !error && ownedCartridges.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ownedCartridges.map((cartridge) => (
              <button
                key={cartridge.tokenId}
                onClick={() => {
                  onSelectCartridge(cartridge);
                  onClose();
                }}
                style={{
                  padding: 12,
                  backgroundColor: '#1a2e1f',
                  border: '2px solid #4a7d5f',
                  borderRadius: 8,
                  color: '#64ff8a',
                  fontFamily: 'Menlo, monospace',
                  fontSize: 14,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#4a7d5f';
                  e.currentTarget.style.borderColor = '#64ff8a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#1a2e1f';
                  e.currentTarget.style.borderColor = '#4a7d5f';
                }}
              >
                <div style={{ fontWeight: 'bold' }}>
                  Cartridge #{cartridge.tokenId}
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Chain: {cartridge.chainId}
                </div>
              </button>
            ))}
          </div>
        )}

        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: 20,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '2px solid #4a7d5f',
              backgroundColor: 'transparent',
              color: '#64ff8a',
              cursor: 'pointer',
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
