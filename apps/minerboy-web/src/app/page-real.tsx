"use client";
import { useState, useEffect } from "react";
import dynamic from 'next/dynamic';
import Stage from "@/components/Stage";
import ActionButton from "@/components/ui/ActionButton";
import DpadButton from "@/components/ui/DpadButton";
import FanSandwich from "@/components/ui/FanSandwich";
import EnhancedShell from "@/components/art/EnhancedShell";
import ClaimOverlay from "@/components/ClaimOverlay";
import Visualizer3x3 from "@/components/Visualizer3x3";
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { useSession } from "@/state/useSession";
import { useMinerWorker } from "@/hooks/useMinerWorker";
import { useTypewriter } from "@/hooks/useTypewriter";
import { api } from "@/lib/api";
import type { CartridgeConfig } from '../../../../packages/shared/src/mining';

const W = 390; // iPhone 13 CSS pixels
const H = 844; // iPhone 13 CSS pixels
const px = (p: number, total: number) => Math.round(total * p / 100);

type FoundResult = {
  hash: `0x${string}`;
  preimage: string;
  attempts: number;
  hr?: number;
};

function Home() {
  const [connectPressed, setConnectPressed] = useState(false);
  const [cartridges, setCartridges] = useState<CartridgeConfig[]>([]);
  const [showCartridgeSelect, setShowCartridgeSelect] = useState(false);
  const [booting, setBooting] = useState(false);
  const [bootLines] = useState(['MINERBOY v2.0 INITIALIZING...', 'LOADING CARTRIDGE...', 'READY TO MINE']);
  const [status, setStatus] = useState<'idle'|'mining'|'found'|'claiming'|'claimed'|'error'>('idle');
  const [foundResult, setFoundResult] = useState<FoundResult | null>(null);
  
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
      setStatus('found');
      setFoundResult({ hash: hash as `0x${string}`, preimage, attempts, hr });
      setFound({ hash: hash as `0x${string}`, preimage, attempts, hr });
      pushLine(`Found hash: ${hash.slice(0, 10)}...`);
      pushLine(`Press B to submit solution`);
      // Switch to grid view to show overlay
      setMode('visual');
    },
    onError: (message) => {
      pushLine(`Error: ${message}`);
      setMining(false);
      setStatus('error');
    },
  });
  
  // Typewriter for boot sequence
  const { displayLines: bootDisplayLines } = useTypewriter(
    booting ? bootLines : [],
    18,
    180,
    () => setBooting(false)
  );
  
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
  
  // Haptic feedback helper
  const hapticFeedback = () => {
    try {
      navigator.vibrate?.(15);
    } catch {
      // Ignore vibration errors
    }
  };
  
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
    } else {
      // Disconnect
      disconnect();
      clear();
      pushLine('Disconnected');
    }
  };
  
  const handleInsertCartridge = () => {
    hapticFeedback();
    if (isConnected && !sessionId) {
      setShowCartridgeSelect(true);
    } else if (!isConnected) {
      pushLine('Connect wallet first!');
    } else {
      pushLine('Cartridge already inserted');
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
    
    console.log('A button pressed - Debug info:', {
      isConnected,
      sessionId,
      job,
      mining,
      cartridge,
      status
    });
    
    // Ignore if already mining or claiming
    if (status === 'mining' || status === 'claiming') {
      console.log('Ignoring A press - already busy');
      return;
    }
    
    if (!isConnected) {
      pushLine('Connect wallet first!');
      return;
    }
    
    if (!sessionId || !job) {
      pushLine('Insert cartridge first!');
      return;
    }
    
    if (!mining) {
      // Start mining
      console.log('Starting mining with job:', job);
      setFoundResult(null);
      setStatus('mining');
      setMining(true);
      setMode('visual'); // Auto-switch to visualizer
      miner.start(job);
      pushLine('Mining started...');
    } else {
      // Stop mining
      console.log('Stopping mining');
      miner.stop();
      setMining(false);
      setStatus('idle');
      pushLine('Mining stopped');
    }
  };
  
  // Claim function
  const handleClaim = async (hit: FoundResult) => {
    try {
      setStatus('claiming');
      pushLine('Submitting claim...');

      // TODO: Add actual claim logic here
      // For now, just simulate success
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setStatus('claimed');
      pushLine('Claim successful!');
      pushLine('Press A to mine again');
      
      // Clear found result after successful claim
      setTimeout(() => {
        setFoundResult(null);
        setStatus('idle');
      }, 3000);
      
    } catch (err: any) {
      console.error('[CLAIM] failed', err);
      pushLine(`Claim failed: ${err?.message ?? 'Unknown error'}`);
      setStatus('error');
    }
  };

  const handleB = () => {
    hapticFeedback();
    
    if (status === 'found' && foundResult) {
      handleClaim(foundResult);
    } else if (lastFound) {
      // Show claim modal (handled by ClaimOverlay component)
      pushLine('Press Claim to submit solution');
    } else {
      // Toggle view
      setMode(mode === 'visual' ? 'terminal' : 'visual');
      pushLine(`Switched to ${mode === 'visual' ? 'terminal' : 'visual'} view`);
    }
  };
  
  const handleDpad = (direction: string) => {
    hapticFeedback();
    
    // Handle mode switching with left/right
    if (direction === 'left') {
      setMode('terminal');
      pushLine('Switched to terminal view');
    } else if (direction === 'right') {
      setMode('visual');
      pushLine('Switched to visualizer view');
    } else {
      pushLine(`D-Pad: ${direction}`);
    }
  };
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
            hapticFeedback();
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mining, miner, setMining, pushLine]);
  // Format hash for display: 0x000000000000000000000000...000000 (first 24 + last 6)
  const formatHashForDisplay = (hash: string | null, suffix: string | null = null) => {
    if (!hash || hash === "idle") {
      return "0x000000000000000000000000...000000"; // idle state
    }
    
    // Remove 0x prefix if present
    const cleanHash = hash.startsWith("0x") ? hash.slice(2) : hash;
    
    // Show first 24 characters, then ..., then last 6 characters
    const prefix = cleanHash.slice(0, 24);
    const suffixToShow = suffix && suffix.length >= 6 ? suffix.slice(-6) : cleanHash.slice(-6);
    
    return `0x${prefix}...${suffixToShow}`;
  };
  
  // LCD display data from state
  const hashLcdText = formatHashForDisplay(job?.nonce || '');
  const statusLcdText = !isConnected ? 'DISCONNECTED' : 
                       !sessionId ? 'DISCONNECTED' :
                       mining ? 'MINING' : 'READY';
  const hashRateLcdText = `${hr.toLocaleString()} H/s`;

  // Helper function for short hash display
  const short = (h?: string, n = 10) =>
    h ? `${h.slice(0, n)}…${h.slice(-n)}` : '';

  // Button styles for overlay
  const btnGreen: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: 10,
    border: '2px solid #8a8a8a',
    background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
    fontWeight: 800,
    fontSize: 12,
    color: '#fff',
    cursor: 'pointer',
  };

  const btnGray: React.CSSProperties = {
    ...btnGreen,
    background: 'linear-gradient(145deg, #4a4a4a, #1a1a1a)',
  };

  return (
    <Stage>
      {/* Hash Found Overlay - only show in visual mode when found */}
      {status === 'found' && mode === 'visual' && foundResult && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(0,0,0,0.55)',
            zIndex: 20,
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              minWidth: 260,
              maxWidth: 340,
              padding: 16,
              borderRadius: 12,
              background: 'linear-gradient(180deg, #1a3d24, #0f2216)',
              border: '2px solid #4a7d5f',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              color: '#c8ffc8',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 1, marginBottom: 6 }}>
              HASH FOUND
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, opacity: 0.9, marginBottom: 12 }}>
              {short(foundResult.hash, 12)} • attempts {foundResult.attempts.toLocaleString()}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={() => handleClaim(foundResult)} style={btnGreen}>Claim (B)</button>
              <button onClick={() => setStatus('idle')} style={btnGray}>Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Shell Background */}
      <div style={{
        position: "absolute",
        inset: 0,
        borderRadius: 28,
        overflow: "hidden",
      }}>
        <EnhancedShell width={W} height={H} />
      </div>

      {/* CRT (square): top 9%, left/right 7% => width 335px */}
      <div style={{
        position: "absolute",
        top: px(9, H) + 10, // 86px (moved down 10px)
        left: px(7, W), // 27px
        width: 335, // W * (1 - 0.14) = 335px
        aspectRatio: "1 / 1",
        background: "#0b2f18", 
        borderRadius: 12, 
        border: "3px solid",
        borderTopColor: "#1a3d24", // darker green for inset top
        borderLeftColor: "#1a3d24", // darker green for inset left
        borderRightColor: "#4a7d5f", // lighter green for inset right
        borderBottomColor: "#4a7d5f", // lighter green for inset bottom 
        boxShadow: "inset 0 3px 6px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.1)", // inset shadow + bottom highlight
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
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
          {/* Boot sequence or normal display */}
          {booting ? (
            // Show typewriter boot sequence
            <div>
              {bootDisplayLines.map((line, index) => (
                <div key={index} style={{ marginBottom: 2 }}>
                  {line}
                </div>
              ))}
            </div>
          ) : mode === 'terminal' ? (
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
          {mining && !booting && mode === 'terminal' && (
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

      {/* Hash LCD: top 56%, left 7%, width 336px */}
      <div style={{
        position: "absolute", 
        top: px(56, H) - 25, // 448px (moved up 25px total)
        left: px(7, W), // 27px
        width: 336, // 390 - 27 - 27
        background: "#0f2c1b", 
        border: "2px solid",
        borderTopColor: "#1a4d2a", // darker green for inset top
        borderLeftColor: "#1a4d2a", // darker green for inset left  
        borderRightColor: "#3a8a4d", // lighter green for inset right
        borderBottomColor: "#3a8a4d", // lighter green for inset bottom 
        borderRadius: 6, 
        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.1)", // inset shadow + bottom highlight
        padding: "6px 8px"
      }}>
        <div style={{
          color: "#64ff8a", 
          fontSize: 13, 
          letterSpacing: 1, 
          fontFamily: "Menlo, monospace", 
          whiteSpace: "nowrap", 
          overflow: "hidden", 
          textOverflow: "ellipsis"
        }}>
          {hashLcdText}
        </div>
      </div>

      {/* Status LCD: top 61.5%, left 7%, width 148px */}
      <div style={{
        position: "absolute", 
        top: px(61.5, H) - 25, // 484px (moved up 25px total)
        left: px(7, W), // 27px
        width: 148, // 390 - 27 - 215
        background: "#0f2c1b", 
        border: "2px solid",
        borderTopColor: "#1a4d2a", // darker green for inset top
        borderLeftColor: "#1a4d2a", // darker green for inset left  
        borderRightColor: "#3a8a4d", // lighter green for inset right
        borderBottomColor: "#3a8a4d", // lighter green for inset bottom 
        borderRadius: 6, 
        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.1)", // inset shadow + bottom highlight
        padding: "6px 8px"
      }}>
        <div style={{
          color: "#64ff8a", 
          fontSize: 12, 
          letterSpacing: 1, 
          fontFamily: "Menlo, monospace"
        }}>
          {statusLcdText}
        </div>
      </div>

      {/* HashRate LCD: top 61.5%, left 226px, width 137px */}
      <div style={{
        position: "absolute", 
        top: px(61.5, H) - 25, // 484px (moved up 25px total)
        left: 226, // 58% of 390
        width: 137, // 390 - 226 - 27
        background: "#0f2c1b", 
        border: "2px solid",
        borderTopColor: "#1a4d2a", // darker green for inset top
        borderLeftColor: "#1a4d2a", // darker green for inset left  
        borderRightColor: "#3a8a4d", // lighter green for inset right
        borderBottomColor: "#3a8a4d", // lighter green for inset bottom 
        borderRadius: 6, 
        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.1)", // inset shadow + bottom highlight
        padding: "6px 8px"
      }}>
        <div style={{
          color: "#64ff8a", 
          fontSize: 12, 
          letterSpacing: 1, 
          fontFamily: "Menlo, monospace"
        }}>
          {hashRateLcdText}
        </div>
      </div>

      {/* CONNECT pill: 46px from bottom, left 37px */}
      <div style={{ position: "absolute", left: 37, bottom: 775 }}>
        <button
          onClick={handleConnect}
          onPointerDown={() => setConnectPressed(true)}
          onPointerUp={() => setConnectPressed(false)}
          onPointerLeave={() => setConnectPressed(false)}
          style={{
            width: 90, // 90% of 100
            height: 27, // 90% of 30 
            borderRadius: 18, 
            border: "2px solid",
            borderTopColor: connectPressed ? "#1a1a1a" : "#8a8a8a", // top highlight/shadow
            borderLeftColor: connectPressed ? "#1a1a1a" : "#8a8a8a", // left highlight/shadow  
            borderRightColor: connectPressed ? "#6a6a6a" : "#2a2a2a", // right shadow/highlight
            borderBottomColor: connectPressed ? "#6a6a6a" : "#2a2a2a", // bottom shadow/highlight
            cursor: "pointer",
            background: "linear-gradient(145deg, #4a4a4a, #1a1a1a)",
            boxShadow: connectPressed 
              ? "inset 0 2px 3px rgba(0,0,0,0.6)" 
              : "0 2px 2px rgba(0,0,0,0.5)",
            fontWeight: 900, 
            fontSize: 10, // smaller text to fit 90% button
            letterSpacing: 0.5, 
            color: "#ffffff",
            transform: connectPressed ? "translateY(2px)" : "translateY(0)",
            transition: "transform 120ms, border-color 120ms",
          }}
        >
{!isConnected ? 'CONNECT' : sessionId ? 'DISCONNECT' : 'CONNECT'}
        </button>
      </div>

      {/* INSERT CARTRIDGE button: next to connect button */}
      {isConnected && !sessionId && (
        <div style={{ position: "absolute", left: 140, bottom: 775 }}>
          <button
            onClick={handleInsertCartridge}
            style={{
              width: 120,
              height: 27,
              borderRadius: 18, 
              border: "2px solid",
              borderTopColor: "#8a8a8a",
              borderLeftColor: "#8a8a8a",
              borderRightColor: "#2a2a2a",
              borderBottomColor: "#2a2a2a",
              cursor: "pointer",
              background: "linear-gradient(145deg, #4a7d5f, #1a3d24)",
              boxShadow: "0 2px 2px rgba(0,0,0,0.5)",
              fontWeight: 900, 
              fontSize: 9,
              letterSpacing: 0.5, 
              color: "#ffffff",
              transition: "transform 120ms, border-color 120ms",
            }}
          >
            INSERT CARTRIDGE
          </button>
        </div>
      )}

      {/* D-pad Up: moved 25px right, 50px down */}
      <div style={{ position: "absolute", left: 92, bottom: 253.5 }}>
        <DpadButton direction="up" size={38} onPress={() => handleDpad('up')} />
      </div>
      
      {/* D-pad Down: moved 25px right, 50px down */}
      <div style={{ position: "absolute", left: 92, bottom: 159.5 }}>
        <DpadButton direction="down" size={38} onPress={() => handleDpad('down')} />
      </div>
      
      {/* D-pad Left: moved 25px right, 50px down */}
      <div style={{ position: "absolute", left: 45, bottom: 206.5 }}>
        <DpadButton direction="left" size={38} onPress={() => handleDpad('left')} />
      </div>
      
      {/* D-pad Right: moved 25px right, 50px down */}
      <div style={{ position: "absolute", left: 139, bottom: 206.5 }}>
        <DpadButton direction="right" size={38} onPress={() => handleDpad('right')} />
      </div>

      {/* A button: moved up 7.5px, left 2.5px */}
      <div style={{ position: "absolute", right: 37.5, bottom: 197.5 }}>
        <ActionButton label="A" onPress={handleA} size={80} variant="primary" />
      </div>

      {/* B button: moved up 7.5px, left 2.5px */}
      <div style={{ position: "absolute", right: 127.5, bottom: 138.5 }}>
        <ActionButton label="B" onPress={handleB} size={60} variant="secondary" />
      </div>

      {/* Fan: right 60px, bottom 60px */}
      <div style={{ position: "absolute", right: 19, bottom: 55 }}>
        <FanSandwich spinning={mining} size={110} />
      </div>

      {/* LEDs: top-right row */}
      <div style={{ 
        position: "absolute", 
        top: 37.5, 
        right: 20, 
        display: "flex", 
        gap: 12 
      }}>
        {["PWR", "NET", "HASH", "MINE"].map((label, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div style={{
              width: 10, 
              height: 10, 
              borderRadius: 10,
              background: i === 0 || (i === 3 && mining) ? "#51ff7a" : "#0b3d21",
              boxShadow: "0 0 6px rgba(81,255,122,0.6)"
            }} />
            <div style={{
              color: "#6ccf85", 
              fontSize: 9, 
              marginTop: 2
            }}>
              {label}
            </div>
          </div>
        ))}
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
    </Stage>
  );
}

export default dynamic(() => Promise.resolve(Home), { ssr: false });
