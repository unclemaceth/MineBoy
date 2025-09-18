"use client";
import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
import { useNativeGlyphConnection, LoginButton } from '@use-glyph/sdk-react';
import { isiOSPWA, reserveDeepLinkWindow, buildUniversalLink, openDeepLink, copyWalletConnectUri, logConnectionAttempt } from '@/utils/iosPwaWallet';
import { useWalletConnect } from '@/hooks/useWalletConnect';

interface WalletConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalletConnectionModal({ isOpen, onClose }: WalletConnectionModalProps) {
  const [selectedOption, setSelectedOption] = useState<'glyph' | 'walletconnect' | 'metamask' | 'coinbase' | null>(null);
  const [glyphStep, setGlyphStep] = useState<'connect' | 'login'>('connect');
  const [wcUri, setWcUri] = useState<string>('');
  const [showCopyButton, setShowCopyButton] = useState(false);
  const { connect } = useConnect();
  useAccount();
  const { connect: glyphConnect } = useNativeGlyphConnection();
  const { connectWalletConnect } = useWalletConnect();

  const handleGlyphConnect = async () => {
    try {
      await glyphConnect();
      setGlyphStep('login');
    } catch (error) {
      console.error('Glyph connection failed:', error);
    }
  };

  const handleWalletConnect = async () => {
    logConnectionAttempt();
    reserveDeepLinkWindow();
    
    try {
      // Use the hook's WalletConnect function
      await connectWalletConnect();
    } catch (error) {
      console.log('WalletConnect failed, trying injected:', error);
      // Fallback to injected wallet
      connect({ connector: injected() });
    }
  };

  const handleMetamaskConnect = async () => {
    logConnectionAttempt();
    reserveDeepLinkWindow();
    
    if (wcUri) {
      const url = buildUniversalLink('metamask', wcUri);
      openDeepLink(url);
    } else {
      // Try direct connection first
      try {
        await connect({ connector: injected() });
      } catch (error) {
        console.log('Direct MetaMask failed, trying WalletConnect:', error);
        await handleWalletConnect();
      }
    }
  };

  const handleCoinbaseConnect = async () => {
    logConnectionAttempt();
    reserveDeepLinkWindow();
    
    if (wcUri) {
      const url = buildUniversalLink('coinbase', wcUri);
      openDeepLink(url);
    } else {
      // Try direct connection first
      try {
        await connect({ connector: injected() });
      } catch (error) {
        console.log('Direct Coinbase failed, trying WalletConnect:', error);
        await handleWalletConnect();
      }
    }
  };

  const handleCopyUri = async () => {
    if (wcUri) {
      const success = await copyWalletConnectUri(wcUri);
      if (success) {
        alert('Connection link copied to clipboard!');
      } else {
        alert('Failed to copy. Please try again.');
      }
    }
  };

  // Listen for WalletConnect URI events
  useEffect(() => {
    if (selectedOption === 'walletconnect' || selectedOption === 'metamask' || selectedOption === 'coinbase') {
      // Set up WalletConnect URI listener
      const handleDisplayUri = (uri: string) => {
        console.log('[WalletConnect] Display URI received:', uri.length, 'chars');
        setWcUri(uri);
        setShowCopyButton(true);
        
        // Auto-open deep link for mobile
        if (isiOSPWA) {
          const wallet = selectedOption === 'metamask' ? 'metamask' : 
                        selectedOption === 'coinbase' ? 'coinbase' : 'generic';
          const url = buildUniversalLink(wallet, uri);
          setTimeout(() => openDeepLink(url), 500); // Small delay to ensure URI is set
        }
      };

      // Listen for WalletConnect events
      window.addEventListener('walletconnect_display_uri', (e: any) => {
        handleDisplayUri(e.detail.uri);
      });

      return () => {
        window.removeEventListener('walletconnect_display_uri', handleDisplayUri);
      };
    }
  }, [selectedOption]);

  const handleClose = () => {
    setSelectedOption(null);
    setGlyphStep('connect');
    setWcUri('');
    setShowCopyButton(false);
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
            
            {isiOSPWA && (
              <div style={{
                backgroundColor: '#2a2a2a',
                border: '1px solid #444',
                borderRadius: '6px',
                padding: '12px',
                marginBottom: '16px',
                fontSize: '12px',
                color: '#ccc'
              }}>
                📱 <strong>iOS PWA Detected:</strong> Using mobile-optimized wallet connection
              </div>
            )}
            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
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
                Glyph Wallet
              </button>

              {isiOSPWA ? (
                <>
                  <button
                    onClick={() => setSelectedOption('metamask')}
                    style={{
                      backgroundColor: '#f6851b',
                      border: '2px solid #f6851b',
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
                      e.currentTarget.style.backgroundColor = '#e2761b';
                      e.currentTarget.style.borderColor = '#e2761b';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#f6851b';
                      e.currentTarget.style.borderColor = '#f6851b';
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>🦊</span>
                    MetaMask
                  </button>

                  <button
                    onClick={() => setSelectedOption('coinbase')}
                    style={{
                      backgroundColor: '#0052ff',
                      border: '2px solid #0052ff',
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
                      e.currentTarget.style.backgroundColor = '#0041cc';
                      e.currentTarget.style.borderColor = '#0041cc';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#0052ff';
                      e.currentTarget.style.borderColor = '#0052ff';
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>🔵</span>
                    Coinbase Wallet
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setSelectedOption('walletconnect')}
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
                  <span style={{ fontSize: '20px' }}>🔗</span>
                  WalletConnect
                </button>
              )}
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
        ) : (
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
              <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                {selectedOption === 'metamask' ? 'MetaMask' : 
                 selectedOption === 'coinbase' ? 'Coinbase Wallet' : 'WalletConnect'}
              </span>
            </div>
            
            {isiOSPWA && (
              <div style={{
                backgroundColor: '#2a2a2a',
                border: '1px solid #444',
                borderRadius: '6px',
                padding: '12px',
                marginBottom: '16px',
                fontSize: '12px',
                color: '#ccc'
              }}>
                📱 <strong>iOS PWA Mode:</strong> Tap your wallet below to open it directly
              </div>
            )}
            
            <p style={{
              marginBottom: '20px',
              color: '#ccc',
              fontSize: '14px'
            }}>
              {selectedOption === 'metamask' ? 'Connect with MetaMask:' :
               selectedOption === 'coinbase' ? 'Connect with Coinbase Wallet:' :
               'Connect with any WalletConnect-compatible wallet:'}
            </p>
            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {selectedOption === 'walletconnect' && (
                <button
                  onClick={handleWalletConnect}
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
                  🔗 Connect with WalletConnect
                </button>
              )}

              {selectedOption === 'metamask' && (
                <button
                  onClick={handleMetamaskConnect}
                  style={{
                    backgroundColor: '#f6851b',
                    border: '2px solid #f6851b',
                    borderRadius: '6px',
                    padding: '16px',
                    color: '#fff',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    width: '100%',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#e2761b';
                    e.currentTarget.style.borderColor = '#e2761b';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#f6851b';
                    e.currentTarget.style.borderColor = '#f6851b';
                  }}
                >
                  🦊 Open in MetaMask
                </button>
              )}

              {selectedOption === 'coinbase' && (
                <button
                  onClick={handleCoinbaseConnect}
                  style={{
                    backgroundColor: '#0052ff',
                    border: '2px solid #0052ff',
                    borderRadius: '6px',
                    padding: '16px',
                    color: '#fff',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    width: '100%',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#0041cc';
                    e.currentTarget.style.borderColor = '#0041cc';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#0052ff';
                    e.currentTarget.style.borderColor = '#0052ff';
                  }}
                >
                  🔵 Open in Coinbase Wallet
                </button>
              )}

              {showCopyButton && wcUri && (
                <button
                  onClick={handleCopyUri}
                  style={{
                    backgroundColor: '#2a2a2a',
                    border: '2px solid #666',
                    borderRadius: '6px',
                    padding: '12px',
                    color: '#ccc',
                    fontSize: '14px',
                    cursor: 'pointer',
                    width: '100%',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#333';
                    e.currentTarget.style.borderColor = '#888';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#2a2a2a';
                    e.currentTarget.style.borderColor = '#666';
                  }}
                >
                  📋 Copy Connection Link
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
