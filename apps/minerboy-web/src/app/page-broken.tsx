"use client";
import { useState, useEffect } from "react";
import Stage from "@/components/Stage";
import ActionButton from "@/components/ui/ActionButton";
import DpadButton from "@/components/ui/DpadButton";
import FanSandwich from "@/components/ui/FanSandwich";
import EnhancedShell from "@/components/art/EnhancedShell";
import Visualizer3x3 from "@/components/Visualizer3x3";
import { useSession } from "@/state/useSession";
import { useMinerWorker } from "@/hooks/useMinerWorker";

const W = 390; // iPhone 13 CSS pixels
const H = 844; // iPhone 13 CSS pixels
const px = (p: number, total: number) => Math.round(total * p / 100);

export default function Home() {
  const [connectPressed, setConnectPressed] = useState(false);
  const [cartridges, setCartridges] = useState<CartridgeConfig[]>([]);
  const [showCartridgeSelect, setShowCartridgeSelect] = useState(false);
  
  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  
  // Session state
  const { 
    wallet,
    cartridge,
    sessionId,
    job,
    mining, 
    attempts, 
    hr, 
    lastFound,
    terminal,
    mode,
    setWallet,
    setMining,
    setTelemetry,
    setFound,
    pushLine,
    setMode,
    loadOpenSession,
    clear
  } = useSession();
  
  // Miner worker
  const miner = useMinerWorker({
    onTick: (a, hashRate) => setTelemetry(a, hashRate),
    onFound: ({ hash, preimage, attempts, hr }) => {
      setMining(false);
      setFound({ hash: hash as `0x${string}`, preimage, attempts, hr });
      pushLine(`Found hash: ${hash.slice(0, 10)}...`);
    },
    onError: (message) => {
      pushLine(`Error: ${message}`);
      setMining(false);
    },
  });
  
  // Haptic feedback
  const hapticFeedback = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15);
    }
  };
  
  // Update wallet when account changes
  useEffect(() => {
    if (isConnected && address) {
      setWallet(address);
    } else {
      setWallet(undefined);
      clear();
    }
  }, [isConnected, address, setWallet, clear]);
  
  // Load cartridges on mount
  useEffect(() => {
    api.cartridges()
      .then(setCartridges)
      .catch(err => pushLine(`Failed to load cartridges: ${err.message}`));
  }, [pushLine]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          handleDpad('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleDpad('down');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleDpad('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleDpad('right');
          break;
        case 'z':
        case 'Z':
          e.preventDefault();
          handleA();
          break;
        case 'x':
        case 'X':
          e.preventDefault();
          handleB();
          break;
        case 'Enter':
          e.preventDefault();
          handleConnect();
          break;
        case 'Escape':
          e.preventDefault();
          if (mining) {
            miner.stop();
            setMining(false);
            pushLine('Mining stopped');
          }
          break;
        case 's':
        case 'S':
          e.preventDefault();
          setMode(mode === 'terminal' ? 'visual' : 'terminal');
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mining, mode, miner, setMining, setMode, pushLine]);
  
  // Button handlers
  const handleConnect = async () => {
    hapticFeedback();
    setConnectPressed(true);
    setTimeout(() => setConnectPressed(false), 150);
    
    if (!isConnected) {
      // Connect wallet
      try {
        connect({ connector: injected() });
        pushLine('Connecting wallet...');
      } catch (error) {
        pushLine(`Connection failed: ${error}`);
      }
    } else if (!sessionId) {
      // Show cartridge selection
      setShowCartridgeSelect(true);
    } else {
      // Disconnect
      disconnect();
      clear();
      pushLine('Disconnected');
    }
  };
  
  const handleCartridgeSelect = async (cartridgeInfo: CartridgeConfig, tokenId: string) => {
    if (!address) return;
    
    setShowCartridgeSelect(false);
    pushLine(`Opening session with ${cartridgeInfo.name}...`);
    
    try {
      const res = await api.openSession({
        wallet: address,
        cartridge: {
          chainId: cartridgeInfo.chainId,
          contract: cartridgeInfo.contract,
          tokenId
        }
      });
      
      loadOpenSession(res, address, { info: cartridgeInfo, tokenId });
      pushLine('Session opened successfully!');
      
    } catch (error) {
      pushLine(`Session failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  const handleA = () => {
    hapticFeedback();
    
    if (!sessionId || !job) {
      pushLine('No active session');
      return;
    }
    
    if (!mining) {
      // Start mining
      setMining(true);
      setMode('visual'); // Auto-switch to visualizer
      miner.start(job);
      pushLine('Mining started...');
    } else {
      // Stop mining
      miner.stop();
      setMining(false);
      pushLine('Mining stopped');
    }
  };
  
  const handleB = () => {
    hapticFeedback();
    
    if (lastFound) {
      // Show claim modal (handled by ClaimOverlay component)
      pushLine('Press Claim to submit solution');
    } else {
      pushLine('Menu: Use D-pad ← → to switch views');
    }
  };
  
  const handleDpad = (direction: 'up' | 'down' | 'left' | 'right') => {
    hapticFeedback();
    
    switch (direction) {
      case 'left':
        setMode('terminal');
        pushLine('Switched to terminal view');
        break;
      case 'right':
        setMode('visual');
        pushLine('Switched to visual view');
        break;
      case 'up':
        pushLine('D-pad: UP');
        break;
      case 'down':
        pushLine('D-pad: DOWN');
        break;
    }
  };
  
  // Format hash for display
  const formatHashForDisplay = (hash: string) => {
    if (!hash || hash.length < 32) return '0x000000000000000000000000...000000';
    const clean = hash.replace('0x', '');
    return `0x${clean.slice(0, 24)}...${clean.slice(-6)}`;
  };
  
  // LCD text
  const hashLcdText = formatHashForDisplay(job?.nonce || '');
  const statusLcdText = !isConnected ? 'DISCONNECTED' : 
                       !sessionId ? 'NO SESSION' :
                       mining ? 'MINING' : 'READY';
  const hashRateLcdText = `${hr.toLocaleString()} H/s`;
  
  return (
    <Stage>
      <div style={{
        position: "relative",
        width: W,
        height: H,
        background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
        overflow: "hidden",
      }}>
        {/* Enhanced Shell Background */}
        <EnhancedShell />
        
        {/* Fan Sandwich */}
        <div style={{
          position: "absolute",
          top: px(20, H),
          right: px(12, W),
          width: px(25, W),
          height: px(25, W),
        }}>
          <FanSandwich spinning={mining} />
        </div>
        
        {/* CRT Screen */}
        <div style={{
          position: "absolute",
          top: px(28, H),
          left: px(7, W),
          width: px(86, W),
          height: px(40, W),
          background: "linear-gradient(135deg, #001100 0%, #003300 100%)",
          border: "3px solid #333",
          borderTopColor: "#666",
          borderLeftColor: "#666",
          borderRightColor: "#111",
          borderBottomColor: "#111",
          borderRadius: 8,
          boxShadow: "inset 0 0 20px rgba(0, 0, 0, 0.8), 0 4px 8px rgba(0, 0, 0, 0.3)",
          overflow: "hidden",
        }}>
          <div style={{
            color: "#64ff8a",
            fontFamily: "Menlo, monospace",
            fontSize: 12,
            textAlign: "left",
            width: "100%",
            height: "100%",
            padding: 8,
            overflow: "hidden",
            position: "relative",
          }}>
            {mode === 'terminal' ? (
              // Terminal mode - show last 8 lines
              <div>
                {terminal.slice(-8).map((line, index) => (
                  <div key={index} style={{
                    marginBottom: 2,
                    opacity: index < 2 ? 0.6 : 1, // Fade older lines
                  }}>
                    {line}
                  </div>
                ))}
              </div>
            ) : (
              // Visual mode - show 3x3 visualizer
              <Visualizer3x3 />
            )}

            {/* Live telemetry when mining (only show in terminal mode) */}
            {mining && mode === 'terminal' && (
              <div style={{ 
                position: "absolute",
                top: 8,
                right: 8,
                fontSize: 10,
                opacity: 0.8,
                textAlign: "right",
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                padding: "2px 4px",
                borderRadius: 4,
              }}>
                <div>HR: {hr.toLocaleString()}</div>
                <div>A: {attempts.toLocaleString()}</div>
              </div>
            )}
          </div>
        </div>

        {/* Hash LCD */}
        <div style={{
          position: "absolute",
          top: px(56, H),
          left: px(7, W),
          width: px(86, W),
          height: px(6, W),
          background: "linear-gradient(135deg, #2a4a2a 0%, #1a3a1a 100%)",
          border: "2px solid #333",
          borderTopColor: "#111",
          borderLeftColor: "#111", 
          borderRightColor: "#666",
          borderBottomColor: "#666",
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.5), 0 -2px 4px rgba(100, 255, 138, 0.1)",
        }}>
          <div style={{
            color: "#64ff8a",
            fontFamily: "Menlo, monospace",
            fontSize: 10,
            fontWeight: "bold",
            textShadow: "0 0 4px #64ff8a",
          }}>
            {hashLcdText}
          </div>
        </div>

        {/* Status LCD */}
        <div style={{
          position: "absolute",
          top: px(64, H),
          left: px(7, W),
          width: px(42, W),
          height: px(6, W),
          background: "linear-gradient(135deg, #2a4a2a 0%, #1a3a1a 100%)",
          border: "2px solid #333",
          borderTopColor: "#111",
          borderLeftColor: "#111",
          borderRightColor: "#666", 
          borderBottomColor: "#666",
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.5), 0 -2px 4px rgba(100, 255, 138, 0.1)",
        }}>
          <div style={{
            color: "#64ff8a",
            fontFamily: "Menlo, monospace",
            fontSize: 10,
            fontWeight: "bold",
            textShadow: "0 0 4px #64ff8a",
          }}>
            {statusLcdText}
          </div>
        </div>

        {/* Hash Rate LCD */}
        <div style={{
          position: "absolute",
          top: px(64, H),
          left: px(51, W),
          width: px(42, W),
          height: px(6, W),
          background: "linear-gradient(135deg, #2a4a2a 0%, #1a3a1a 100%)",
          border: "2px solid #333",
          borderTopColor: "#111",
          borderLeftColor: "#111",
          borderRightColor: "#666",
          borderBottomColor: "#666", 
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.5), 0 -2px 4px rgba(100, 255, 138, 0.1)",
        }}>
          <div style={{
            color: "#64ff8a",
            fontFamily: "Menlo, monospace",
            fontSize: 10,
            fontWeight: "bold",
            textShadow: "0 0 4px #64ff8a",
          }}>
            {hashRateLcdText}
          </div>
        </div>

        {/* D-pad buttons */}
        <div style={{ position: "absolute", top: px(78, H), left: px(20, W) }}>
          <DpadButton direction="up" size={px(8, W)} onPress={() => handleDpad('up')} />
        </div>
        <div style={{ position: "absolute", top: px(86, H), left: px(12, W) }}>
          <DpadButton direction="left" size={px(8, W)} onPress={() => handleDpad('left')} />
        </div>
        <div style={{ position: "absolute", top: px(86, H), left: px(28, W) }}>
          <DpadButton direction="right" size={px(8, W)} onPress={() => handleDpad('right')} />
        </div>
        <div style={{ position: "absolute", top: px(94, H), left: px(20, W) }}>
          <DpadButton direction="down" size={px(8, W)} onPress={() => handleDpad('down')} />
        </div>

        {/* Action buttons */}
        <div style={{ position: "absolute", top: px(85, H), right: px(20, W) }}>
          <ActionButton 
            label="B" 
            size={px(12, W)} 
            onPress={handleB}
          />
        </div>
        <div style={{ position: "absolute", top: px(85, H), right: px(6, W) }}>
          <ActionButton 
            label="A" 
            size={px(12, W)} 
            onPress={handleA}
          />
        </div>

        {/* Connect button */}
        <div style={{
          position: "absolute",
          bottom: px(5, H),
          left: "50%",
          transform: "translateX(-50%)",
        }}>
          <button
            onClick={handleConnect}
            style={{
              background: connectPressed 
                ? "linear-gradient(135deg, #333 0%, #555 100%)"
                : "linear-gradient(135deg, #555 0%, #777 100%)",
              border: "3px solid",
              borderTopColor: connectPressed ? "#222" : "#999",
              borderLeftColor: connectPressed ? "#222" : "#999", 
              borderRightColor: connectPressed ? "#999" : "#222",
              borderBottomColor: connectPressed ? "#999" : "#222",
              borderRadius: 8,
              padding: "12px 24px",
              color: "#fff",
              fontFamily: "Menlo, monospace",
              fontSize: 14,
              fontWeight: "bold",
              cursor: "pointer",
              transform: connectPressed ? "translateY(2px)" : "translateY(0px)",
              boxShadow: connectPressed 
                ? "0 2px 4px rgba(0, 0, 0, 0.3)"
                : "0 4px 8px rgba(0, 0, 0, 0.3)",
              transition: "all 0.1s ease",
            }}
          >
            {!isConnected ? 'CONNECT' : !sessionId ? 'INSERT CARTRIDGE' : 'DISCONNECT'}
          </button>
        </div>

        {/* Cartridge Selection Modal */}
        {showCartridgeSelect && (
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
              maxWidth: 300,
              width: '90%',
            }}>
              <h3 style={{ color: '#64ff8a', marginBottom: 16, textAlign: 'center' }}>
                Select Cartridge
              </h3>
              {cartridges.map((cart) => (
                <div key={cart.contract} style={{ marginBottom: 12 }}>
                  <div style={{ color: '#fff', marginBottom: 4 }}>{cart.name}</div>
                  <input
                    type="text"
                    placeholder="Token ID"
                    style={{
                      width: '100%',
                      padding: 8,
                      backgroundColor: '#333',
                      border: '1px solid #555',
                      borderRadius: 4,
                      color: '#fff',
                      marginBottom: 8,
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const tokenId = (e.target as HTMLInputElement).value;
                        if (tokenId) {
                          handleCartridgeSelect(cart, tokenId);
                        }
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      const input = document.querySelector('input[placeholder="Token ID"]') as HTMLInputElement;
                      const tokenId = input?.value;
                      if (tokenId) {
                        handleCartridgeSelect(cart, tokenId);
                      }
                    }}
                    style={{
                      backgroundColor: '#64ff8a',
                      color: '#000',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    Select
                  </button>
                </div>
              ))}
              <button
                onClick={() => setShowCartridgeSelect(false)}
                style={{
                  backgroundColor: '#333',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  width: '100%',
                  marginTop: 12,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Claim Overlay */}
        {lastFound && (
          <ClaimOverlay />
        )}
      </div>
    </Stage>
  );
}
