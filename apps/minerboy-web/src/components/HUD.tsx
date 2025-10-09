"use client";
import React from 'react';
import ScrollingMessageBar from './ScrollingMessageBar';

interface HUDProps {
  pickaxeType?: string;      // "The DripAxe", "The Morgul PickHammer", "Blue Steel"
  pickaxeId?: string;        // Token ID
  multiplier?: number;       // 1.0, 1.2, 1.5
  multiplierSource?: string; // "NAPC", "BASE", etc.
  seasonPoints?: number;     // User's season points
  width: number;             // Total width (390px)
  messages?: Array<string | { text: string; color?: string; prefix?: string; type?: string }>;  // Scrolling messages
  scrollSpeed?: number;      // Scroll speed in px/s
  messageGap?: number;       // Gap between messages in px
  loopPause?: number;        // Pause at end of loop in ms
  onMessageBarClick?: () => void; // Callback when message bar is clicked
  onMnestrClick?: () => void;     // Callback when MNESTR panel is clicked
}

export default function HUD({
  pickaxeType,
  pickaxeId,
  multiplier = 1.0,
  multiplierSource = "BASE",
  seasonPoints = 0,
  width,
  messages = ["MineBoy™ it Mines stuff!"],
  scrollSpeed = 50,
  messageGap = 100,
  loopPause = 2000,
  onMessageBarClick,
  onMnestrClick,
}: HUDProps) {
  const panelWidth = Math.floor(width / 4) - 4; // 4 panels with small gaps
  const panelHeight = 50;

  // Format pickaxe display name - simplified names without brackets
  let pickaxeName = "NO MINECART";
  if (pickaxeType) {
    if (pickaxeType.includes("DripAxe")) {
      pickaxeName = "DripAxe";
    } else if (pickaxeType.includes("PickHammer")) {
      pickaxeName = "PickHammer";
    } else if (pickaxeType.includes("Blue Steel")) {
      pickaxeName = "BlueSteel";
    } else {
      pickaxeName = pickaxeType.replace("The ", "").replace("The Morgul ", "");
    }
  }
  
  const pickaxeDisplay = pickaxeName;

  // Format multiplier display - remove brackets
  const multiplierDisplay = multiplier > 1.0 
    ? `${multiplier.toFixed(1)}x ${multiplierSource}`
    : `${multiplier.toFixed(1)}x`;

  // Format season points
  const pointsDisplay = seasonPoints.toLocaleString();

  return (
    <div
      style={{
        width: `${width}px`,
        backgroundColor: 'transparent',
      }}
    >
      {/* Top padding */}
      <div style={{ height: '10px' }} />
      
      {/* LCD Panels */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        {/* Panel 1: MineCart Type */}
        <LCDPanel
          label="MINECART"
          value={pickaxeDisplay}
          width={panelWidth}
          height={panelHeight}
        />

        {/* Panel 2: Multiplier */}
        <LCDPanel
          label="MULTIPLIER"
          value={multiplierDisplay}
          width={panelWidth}
          height={panelHeight}
        />

        {/* Panel 3: Season Points */}
        <LCDPanel
          label="SEASON PTS"
          value={pointsDisplay}
          width={panelWidth}
          height={panelHeight}
        />

        {/* Panel 4: MNESTR Flywheel - Button Style */}
        <div
          onClick={onMnestrClick}
          style={{
            width: panelWidth,
            height: panelHeight,
            background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
            border: '2px solid',
            borderTopColor: 'rgba(255,255,255,0.2)',
            borderLeftColor: 'rgba(255,255,255,0.2)',
            borderBottomColor: 'rgba(0,0,0,0.4)',
            borderRightColor: 'rgba(0,0,0,0.4)',
            borderRadius: '8px',
            boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.15), inset 0 -1px 2px rgba(0,0,0,0.3), 0 4px 8px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: onMnestrClick ? 'pointer' : 'default',
            fontFamily: 'monospace',
            fontSize: '11px',
            fontWeight: 'bold',
            color: '#F0E68C',
            textShadow: '0 1px 2px rgba(0,0,0,0.5)',
            transition: 'all 0.1s ease',
            userSelect: 'none',
            transform: 'scale(1)',
          }}
          onMouseEnter={(e) => {
            if (onMnestrClick) {
              e.currentTarget.style.background = 'linear-gradient(145deg, #5a8d6f, #2a4d34)';
              e.currentTarget.style.transform = 'scale(1.03)';
            }
          }}
          onMouseLeave={(e) => {
            if (onMnestrClick) {
              e.currentTarget.style.background = 'linear-gradient(145deg, #4a7d5f, #1a3d24)';
              e.currentTarget.style.transform = 'scale(1)';
            }
          }}
          onPointerDown={(e) => {
            if (onMnestrClick) {
              e.currentTarget.style.borderTopColor = 'rgba(0,0,0,0.4)';
              e.currentTarget.style.borderLeftColor = 'rgba(0,0,0,0.4)';
              e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.2)';
              e.currentTarget.style.borderRightColor = 'rgba(255,255,255,0.2)';
              e.currentTarget.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.5)';
              e.currentTarget.style.background = 'linear-gradient(145deg, #3a6d4f, #0a2d14)';
            }
          }}
          onPointerUp={(e) => {
            if (onMnestrClick) {
              e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.2)';
              e.currentTarget.style.borderLeftColor = 'rgba(255,255,255,0.2)';
              e.currentTarget.style.borderBottomColor = 'rgba(0,0,0,0.4)';
              e.currentTarget.style.borderRightColor = 'rgba(0,0,0,0.4)';
              e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(255,255,255,0.15), inset 0 -1px 2px rgba(0,0,0,0.3), 0 4px 8px rgba(0,0,0,0.5)';
              e.currentTarget.style.background = 'linear-gradient(145deg, #5a8d6f, #2a4d34)';
            }
          }}
        >
          FLYWHEEL
        </div>
      </div>

      {/* Padding between LCDs and message bar */}
      <div style={{ height: '10px' }} />

      {/* Scrolling Message Bar */}
      <div 
        onClick={onMessageBarClick}
        style={{ 
          cursor: onMessageBarClick ? 'pointer' : 'default',
          transition: 'all 0.15s ease',
          transform: 'scale(1)',
          filter: 'brightness(1)',
        }}
        onMouseEnter={(e) => {
          if (onMessageBarClick) {
            e.currentTarget.style.transform = 'scale(1.02)';
            e.currentTarget.style.filter = 'brightness(1.15)';
          }
        }}
        onMouseLeave={(e) => {
          if (onMessageBarClick) {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.filter = 'brightness(1)';
          }
        }}
      >
        <ScrollingMessageBar
          messages={messages}
          width={width}
          height={20}
          speed={scrollSpeed}
          messageGap={messageGap}
          loopPause={loopPause}
        />
      </div>

      {/* Bottom padding */}
      <div style={{ height: '10px' }} />
    </div>
  );
}

interface LCDPanelProps {
  label: string;
  value: string;
  width: number;
  height: number;
  onClick?: () => void;
  clickable?: boolean;
}

function LCDPanel({ label, value, width, height, onClick, clickable }: LCDPanelProps) {
  return (
    <div
      onClick={onClick}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: '#1a1a1a',
        border: '2px solid #333',
        borderRadius: '4px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '4px',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
        cursor: clickable ? 'pointer' : 'default',
        transition: clickable ? 'opacity 0.2s, transform 0.1s' : 'none',
      }}
      onMouseEnter={(e) => {
        if (clickable) {
          e.currentTarget.style.opacity = '0.8';
        }
      }}
      onMouseLeave={(e) => {
        if (clickable) {
          e.currentTarget.style.opacity = '1';
        }
      }}
      onMouseDown={(e) => {
        if (clickable) {
          e.currentTarget.style.transform = 'scale(0.98)';
        }
      }}
      onMouseUp={(e) => {
        if (clickable) {
          e.currentTarget.style.transform = 'scale(1)';
        }
      }}
    >
      {/* Label */}
      <div
        style={{
          fontSize: '8px',
          fontFamily: 'monospace',
          color: '#666',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '2px',
        }}
      >
        {label}
      </div>

      {/* Value */}
      <div
        style={{
          fontSize: '11px',
          fontFamily: 'monospace',
          color: '#00ff00',
          fontWeight: 'bold',
          textAlign: 'center',
          textShadow: '0 0 4px rgba(0,255,0,0.5)',
          lineHeight: '1.2',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%',
        }}
      >
        {value}
      </div>
    </div>
  );
}
