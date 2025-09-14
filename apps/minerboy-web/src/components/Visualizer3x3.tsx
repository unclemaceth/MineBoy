import { useMinerStore } from '@/state/miner';
import { useEffect, useState } from 'react';

interface Visualizer3x3Props {
  fullscreen?: boolean;
  hideHud?: boolean;
  hideHashLine?: boolean;
}

export default function Visualizer3x3({ 
  fullscreen = true, 
  hideHud = true, 
  hideHashLine = true 
}: Visualizer3x3Props) {
  const { currentHash, mining, foundHash } = useMinerStore();
  const [containerSize, setContainerSize] = useState({ width: 300, height: 300 });
  
  // Extract last 9 hex characters for the 3x3 grid
  const getGridData = (hash: string) => {
    const cleanHash = hash.replace('0x', '');
    const last9 = cleanHash.slice(-9);
    
    return Array.from(last9).map(char => {
      const nibble = parseInt(char, 16);
      // Map 0-15 to 0.25-1.0 brightness
      const brightness = 0.25 + (nibble / 15) * 0.75;
      return { nibble, brightness };
    });
  };

  const gridData = getGridData(currentHash);
  
  // Calculate tile size based on container
  const minDimension = Math.min(containerSize.width, containerSize.height);
  const tileSize = Math.floor(minDimension / 3) * 0.85; // 85% to leave gap space
  const gap = Math.floor(tileSize * 0.1);

  // Update container size on mount and resize
  useEffect(() => {
    if (!fullscreen) return;
    
    const updateSize = () => {
      // For fullscreen mode, use the CRT inner dimensions
      const crtWidth = 335 - 24; // CRT width minus padding
      const crtHeight = 335 - 24; // CRT height minus padding
      setContainerSize({ width: crtWidth, height: crtHeight });
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [fullscreen]);

  const containerStyle = fullscreen ? {
    position: 'absolute' as const,
    inset: 0, // Full bleed, no padding
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } : {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
  };

  return (
    <div style={containerStyle}>
      {/* 3x3 Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(3, 1fr)',
        gap: gap,
        width: tileSize * 3 + gap * 2,
        height: tileSize * 3 + gap * 2,
      }}>
        {gridData.map((cell, index) => (
          <div
            key={index}
            style={{
              backgroundColor: `rgba(100, 255, 138, ${cell.brightness})`,
              borderRadius: Math.max(4, tileSize * 0.08),
              border: '1px solid rgba(100, 255, 138, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: Math.max(10, tileSize * 0.25),
              fontFamily: 'Menlo, monospace',
              color: cell.brightness > 0.6 ? '#000' : '#64ff8a',
              fontWeight: 'bold',
              animation: mining ? 'pulse 2s ease-in-out infinite' : 'none',
              animationDelay: `${index * 0.1}s`,
              width: tileSize,
              height: tileSize,
            }}
          >
            {cell.nibble.toString(16).toUpperCase()}
          </div>
        ))}
      </div>

      {/* Only show hash display when not hidden */}
      {!hideHashLine && !fullscreen && (
        <div style={{
          fontSize: 10,
          fontFamily: 'Menlo, monospace',
          color: '#64ff8a',
          opacity: 0.7,
          textAlign: 'center',
          wordBreak: 'break-all',
          maxWidth: '100%',
          marginTop: 16,
        }}>
          ...{currentHash.slice(-9)}
        </div>
      )}

      {/* Claim badge when hash found */}
      {foundHash && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(100, 255, 138, 0.9)',
          color: '#000',
          padding: `${Math.max(8, tileSize * 0.15)}px ${Math.max(16, tileSize * 0.3)}px`,
          borderRadius: Math.max(8, tileSize * 0.15),
          fontSize: Math.max(14, tileSize * 0.25),
          fontWeight: 'bold',
          fontFamily: 'Menlo, monospace',
          animation: 'claimPulse 1s ease-in-out infinite',
          boxShadow: '0 0 20px rgba(100, 255, 138, 0.5)',
          zIndex: 10,
        }}>
          CLAIM
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        
        @keyframes claimPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.1); }
        }
      `}</style>
    </div>
  );
}
