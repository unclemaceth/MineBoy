'use client';
import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { getOwnedCartridges, type OwnedCartridge } from '@/lib/alchemy';

// Local animation URL for all cartridges
const CARTRIDGE_ANIMATION_URL = '/apebitcart.mp4';

interface CartridgeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCartridge: (cartridge: OwnedCartridge) => void;
}

const toDecString = (id: string) => {
  try {
    // already decimal?
    if (/^\d+$/.test(id)) return id;
    // hex or other → normalize
    const hex = id.startsWith('0x') ? id : `0x${id}`;
    return BigInt(hex).toString(10);
  } catch {
    return id; // last resort: pass through
  }
};

export default function CartridgeSelectionModal({
  isOpen,
  onClose,
  onSelectCartridge,
}: CartridgeSelectionModalProps) {
  const { address, isConnected } = useAccount();
  const [ownedCartridges, setOwnedCartridges] = useState<OwnedCartridge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && address) {
      loadOwnedCartridges();
    } else if (isOpen && !address) {
      // Clear stale list if user disconnected
      setOwnedCartridges([]);
    }
  }, [isOpen, address]);

  const loadOwnedCartridges = async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const cartridges = await getOwnedCartridges(address);
      setOwnedCartridges(cartridges);
      if (!cartridges?.length) {
        // Helpful console for debugging contracts/filters
        console.log('[Alchemy] No cartridges found for', address);
      }
    } catch (err) {
      console.error('Error loading cartridges:', err);
      setError('Failed to load cartridges');
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
          textAlign: 'center'
        }}>
          SELECT CARTRIDGE
        </div>

        {!isConnected && (
          <div style={{ color: '#64ff8a', fontSize: 14, textAlign: 'center', padding: 20, fontFamily: 'Menlo, monospace' }}>
            Connect a wallet to load your cartridges.
          </div>
        )}

        {loading && (
          <div style={{ color: '#64ff8a', fontSize: 14, textAlign: 'center', padding: 20, fontFamily: 'Menlo, monospace' }}>
            Loading your cartridges...
          </div>
        )}

        {error && (
          <div style={{ color: '#ff6b6b', fontSize: 14, textAlign: 'center', padding: 20, fontFamily: 'Menlo, monospace' }}>
            {error}
          </div>
        )}

        {!loading && !error && isConnected && ownedCartridges.length === 0 && (
          <div style={{ color: '#64ff8a', fontSize: 14, textAlign: 'center', padding: 20, fontFamily: 'Menlo, monospace' }}>
            No cartridges found in your wallet
            <div style={{ marginTop: 10 }}>
              <button
                onClick={loadOwnedCartridges}
                style={{ padding: '6px 10px', borderRadius: 6, border: '2px solid #4a7d5f',
                  background: 'transparent', color: '#64ff8a', cursor: 'pointer', fontFamily: 'Menlo, monospace' }}>
                Reload
              </button>
            </div>
          </div>
        )}

        {!loading && !error && ownedCartridges.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ownedCartridges.map((c) => {
              const decId = toDecString(c.tokenId);
              return (
                <button
                  key={`${c.contractAddress}-${decId}`}
                  onClick={() => onSelectCartridge({ ...c, tokenId: decId })}
                  style={{
                    padding: 12, backgroundColor: '#1a2e1f', border: '2px solid #4a7d5f',
                    borderRadius: 8, color: '#64ff8a', fontFamily: 'Menlo, monospace',
                    fontSize: 14, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', gap: 12
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
                  {/* Animated Cartridge Image */}
                  <div style={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: 6, 
                    overflow: 'hidden',
                    backgroundColor: '#0f2216',
                    border: '1px solid #4a7d5f',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative'
                  }}>
                    <video
                      src={CARTRIDGE_ANIMATION_URL}
                      autoPlay
                      loop
                      muted
                      playsInline
                      onLoadStart={() => console.log('Video loading started:', CARTRIDGE_ANIMATION_URL)}
                      onCanPlay={() => console.log('Video can play:', CARTRIDGE_ANIMATION_URL)}
                      onError={(e) => console.error('Video error:', e, CARTRIDGE_ANIMATION_URL)}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        position: 'absolute',
                        top: 0,
                        left: 0
                      }}
                    />
                    {/* Fallback image if video fails */}
                    <img
                      src="/ApeBit Cart - MINEBOY.png"
                      alt="Cartridge"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        zIndex: 1
                      }}
                      onError={(e) => console.error('Fallback image error:', e)}
                    />
                  </div>
                  
                  {/* Cartridge Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold' }}>
                      Cartridge #{decId}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      {c.contractAddress.slice(0, 6)}…{c.contractAddress.slice(-4)} • Chain {c.chainId}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '2px solid #4a7d5f',
              backgroundColor: 'transparent', color: '#64ff8a', cursor: 'pointer',
              fontFamily: 'Menlo, monospace'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}