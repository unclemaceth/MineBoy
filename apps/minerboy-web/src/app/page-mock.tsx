"use client";
import { useState, useEffect } from "react";
import Stage from "@/components/Stage";
import ActionButton from "@/components/ui/ActionButton";
import DpadButton from "@/components/ui/DpadButton";
import FanSandwich from "@/components/ui/FanSandwich";
import EnhancedShell from "@/components/art/EnhancedShell";
import ClaimOverlay from "@/components/ClaimOverlay";
import Visualizer3x3 from "@/components/Visualizer3x3";
import { useMinerStore } from "@/state/miner";
import { useMinerLoop } from "@/hooks/useMinerLoop";
import { useTypewriter } from "@/hooks/useTypewriter";

const W = 390; // iPhone 13 CSS pixels
const H = 844; // iPhone 13 CSS pixels
const px = (p: number, total: number) => Math.round(total * p / 100);

export default function Home() {
  const [connectPressed, setConnectPressed] = useState(false);
  
  // Miner state
  const { 
    connected, 
    mining, 
    attempts, 
    hashRate, 
    currentHash, 
    foundHash,
    terminal,
    mode,
    booting,
    bootLines,
    connect,
    disconnect,
    toggleMining,
    pushLine,
    setMode,
    setBooting
  } = useMinerStore();
  
  // Start the miner loop
  useMinerLoop();
  
  // Typewriter for boot sequence
  const { displayLines: bootDisplayLines } = useTypewriter(
    booting ? bootLines : [],
    18,
    180,
    () => setBooting(false)
  );
  
  // Haptic feedback helper
  const hapticFeedback = () => {
    try {
      navigator.vibrate?.(15);
    } catch {
      // Ignore vibration errors
    }
  };
  
  // Button handlers
  const handleConnect = () => {
    hapticFeedback();
    if (connected) {
      disconnect();
    } else {
      connect();
    }
  };
  
  const handleA = () => {
    hapticFeedback();
    if (!connected) {
      pushLine("Connect first!");
      return;
    }
    toggleMining();
  };
  
  const handleB = () => {
    hapticFeedback();
    if (foundHash) {
      // Claim overlay will handle this
      return;
    }
    pushLine("Menu - Not implemented yet");
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
            toggleMining();
            hapticFeedback();
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [connected, mining, foundHash, toggleMining, pushLine, connect, disconnect]);
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
  const hashLcdText = formatHashForDisplay(currentHash);
  const statusLcdText = connected ? (mining ? `A: ${attempts.toLocaleString()}` : "IDLE") : "DISC";
  const hashRateLcdText = `${hashRate.toLocaleString()} H/s`;

  return (
    <Stage>
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
              <div>HR: {hashRate.toLocaleString()}</div>
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
{connected ? "DISCONNECT" : "CONNECT"}
        </button>
      </div>

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
      
      {/* Claim Overlay */}
      <ClaimOverlay />
    </Stage>
  );
}
