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
  messages?: string[];       // Scrolling messages
  scrollSpeed?: number;      // Scroll speed in px/s
  messageGap?: number;       // Gap between messages in px
  onMessageBarClick?: () => void; // Callback when message bar is clicked
}

export default function HUD({
  pickaxeType,
  pickaxeId,
  multiplier = 1.0,
  multiplierSource = "BASE",
  seasonPoints = 0,
  width,
  messages = ["MineBoy it Mines stuff!"],
  scrollSpeed = 50,
  messageGap = 100,
  onMessageBarClick,
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

        {/* Panel 4: Reserved for future use */}
        <LCDPanel
          label="RESERVED"
          value="---"
          width={panelWidth}
          height={panelHeight}
        />
      </div>

      {/* Padding between LCDs and message bar */}
      <div style={{ height: '10px' }} />

      {/* Scrolling Message Bar */}
      <div 
        onClick={onMessageBarClick}
        style={{ 
          cursor: onMessageBarClick ? 'pointer' : 'default',
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => {
          if (onMessageBarClick) {
            e.currentTarget.style.opacity = '0.8';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
      >
        <ScrollingMessageBar
          messages={messages}
          width={width}
          height={20}
          speed={scrollSpeed}
          messageGap={messageGap}
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
}

function LCDPanel({ label, value, width, height }: LCDPanelProps) {
  return (
    <div
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
