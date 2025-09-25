import { useSession } from '@/state/useSession';
import { useEffect, useState } from 'react';
import { hexFrom } from '@/lib/hex';
import { getTierInfo } from '@/lib/rewards';

interface Visualizer3x3Props {
  fullscreen?: boolean;
  hideHud?: boolean;
  hideHashLine?: boolean;
  nibs?: number[];
}

export default function Visualizer3x3({ 
  fullscreen = true, 
  hideHud = true, 
  hideHashLine = true,
  nibs
}: Visualizer3x3Props) {
  const { mining, lastFound, job, claimState, setClaimState } = useSession();
  const [currentHash, setCurrentHash] = useState('0x0000000000000000000000000000000000000000000000000000000000000000');
  const [containerSize, setContainerSize] = useState({ width: 300, height: 300 });
  
  // Use real nibbles from worker or fallback to generated data
  const getGridData = (nibs?: number[]) => {
    if (nibs && nibs.length === 9) {
      // Use real nibbles from worker
      return nibs.map(nibble => {
        // Map 0-15 to 0.25-1.0 brightness
        const brightness = 0.25 + (nibble / 15) * 0.75;
        return { nibble, brightness };
      });
    }
    
    // Fallback to generated data from current hash
    const cleanHash = currentHash.replace('0x', '');
    const last9 = cleanHash.slice(-9);
    
    return Array.from(last9).map(char => {
      const nibble = parseInt(char, 16);
      // Map 0-15 to 0.25-1.0 brightness
      const brightness = 0.25 + (nibble / 15) * 0.75;
      return { nibble, brightness };
    });
  };

  const gridData = getGridData(nibs);
  
  // Generate new hashes when mining
  useEffect(() => {
    if (!mining || !job) {
      setCurrentHash('0x0000000000000000000000000000000000000000000000000000000000000000');
      return;
    }

    let counter = 0;
    
    const generateHash = () => {
      // Generate a realistic-looking hash based on job nonce + counter
      const nonce = hexFrom(job?.nonce, 64).slice(2); // Remove 0x
      const counterHex = counter.toString(16).padStart(8, '0');
      const combined = nonce + counterHex;
      
      // Simple hash simulation - just rotate and modify
      let hash = '0x';
      for (let i = 0; i < 64; i += 2) {
        const idx = (i + counter) % combined.length;
        const char1 = combined[idx] || '0';
        const char2 = combined[(idx + 1) % combined.length] || '0';
        hash += char1 + char2;
      }
      
      setCurrentHash(hash);
      counter++;
    };

    // Start generating hashes every 100ms when mining
    const interval = setInterval(generateHash, 100);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [mining, job]);
  
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
              animationName: mining ? 'pulse' : 'none',
              animationDuration: mining ? '2s' : 'none',
              animationTimingFunction: mining ? 'ease-in-out' : 'none',
              animationIterationCount: mining ? 'infinite' : 'none',
              animationDelay: mining ? `${index * 0.1}s` : 'none',
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

      {/* Claim badge when hash found and ready to claim */}
      {lastFound && claimState === 'ready' && (
        <div 
          onClick={() => setClaimState('overlay')}
          role="button"
          aria-label="Open claim overlay"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(100, 255, 138, 0.92)',
            color: '#000',
            padding: `${Math.max(8, tileSize * 0.15)}px ${Math.max(16, tileSize * 0.3)}px`,
            borderRadius: Math.max(8, tileSize * 0.15),
            fontSize: Math.max(14, tileSize * 0.24),
            fontWeight: 'bold',
            fontFamily: 'Menlo, monospace',
            animation: 'claimPulse 1s ease-in-out infinite',
            boxShadow: '0 0 20px rgba(100, 255, 138, 0.5)',
            zIndex: 10,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          <span>CLAIM</span>
          <span style={{ opacity: 0.8 }}>•</span>
          <span>{lastFound.tierName || getTierInfo(lastFound.hash).name}</span>
          <span style={{ opacity: 0.8 }}>•</span>
          <span>{lastFound.amountLabel || 'Calculating...'}</span>
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
