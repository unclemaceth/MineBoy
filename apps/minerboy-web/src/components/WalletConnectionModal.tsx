"use client";
import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useNativeGlyphConnection, LoginButton } from '@use-glyph/sdk-react';
import ConnectButton from './ConnectButton';

interface WalletConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalletConnectionModal({ isOpen, onClose }: WalletConnectionModalProps) {
  const [selectedOption, setSelectedOption] = useState<'glyph' | 'walletconnect' | 'other' | null>(null);
  const [glyphStep, setGlyphStep] = useState<'connect' | 'login'>('connect');
  const { address, isConnected } = useAccount();
  const { connect: glyphConnect } = useNativeGlyphConnection();

  // Auto-close modal when wallet connects
  useEffect(() => {
    if (isConnected && address && isOpen) {
      handleClose();
    }
  }, [isConnected, address, isOpen]);

  const handleGlyphConnect = async () => {
    try {
      await glyphConnect();
      setGlyphStep('login');
    } catch (error) {
      console.error('Glyph connection failed:', error);
    }
  };


  const handleClose = () => {
    setSelectedOption(null);
    setGlyphStep('connect');
    onClose();
  };

  const handleGlyphLoginComplete = () => {
    handleClose();
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
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        border: '2px solid #333',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '400px',
        width: '100%',
        color: '#fff',
        fontFamily: 'monospace'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#64ff8a'
          }}>
            Connect Wallet
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '0',
              width: '24px',
              height: '24px'
            }}
          >
            ×
          </button>
        </div>

        {!selectedOption ? (
          <div>
            <p style={{
              marginBottom: '20px',
              color: '#ccc',
              fontSize: '14px'
            }}>
              Choose your preferred wallet connection method:
            </p>
            
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px'
            }}>
              <button
                onClick={() => setSelectedOption('glyph')}
                style={{
                  backgroundColor: '#2a2a2a',
                  border: '2px solid #444',
                  borderRadius: '6px',
                  padding: '16px',
                  color: '#fff',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#333';
                  e.currentTarget.style.borderColor = '#555';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#2a2a2a';
                  e.currentTarget.style.borderColor = '#444';
                }}
              >
                <span style={{ fontSize: '20px' }}>🔮</span>
                Glyph
              </button>

              <div style={{ gridColumn: 'span 2' }}>
                <ConnectButton />
              </div>
            </div>
          </div>
        ) : selectedOption === 'glyph' ? (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <button
                onClick={() => setSelectedOption(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#666',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '0',
                  width: '24px',
                  height: '24px'
                }}
              >
                ←
              </button>
              <span style={{ fontSize: '16px', fontWeight: 'bold' }}>Glyph Wallet</span>
            </div>
            
            {glyphStep === 'connect' ? (
              <>
                <p style={{
                  marginBottom: '20px',
                  color: '#ccc',
                  fontSize: '14px'
                }}>
                  Connect with Glyph Wallet for seamless Web3 authentication:
                </p>
                
                <button
                  onClick={handleGlyphConnect}
                  style={{
                    backgroundColor: '#4a5568',
                    border: '2px solid #64ff8a',
                    borderRadius: '6px',
                    padding: '16px',
                    color: '#64ff8a',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    width: '100%',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#64ff8a';
                    e.currentTarget.style.color = '#1a1a1a';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#4a5568';
                    e.currentTarget.style.color = '#64ff8a';
                  }}
                >
                  Connect to Glyph
                </button>
              </>
            ) : (
              <>
                <p style={{
                  marginBottom: '20px',
                  color: '#ccc',
                  fontSize: '14px'
                }}>
                  Complete authentication by signing a message:
                </p>
                
                <div style={{
                  backgroundColor: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '6px',
                  padding: '16px',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    backgroundColor: '#4a5568',
                    border: '2px solid #64ff8a',
                    borderRadius: '6px',
                    padding: '16px',
                    color: '#64ff8a',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    width: '100%',
                    transition: 'all 0.2s',
                    textAlign: 'center'
                  }}>
                    <LoginButton />
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
