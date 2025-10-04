"use client";
import React from 'react';

interface HUDProps {
  pickaxeType?: string;      // "The DripAxe", "The Morgul PickHammer", "Blue Steel"
  pickaxeId?: string;        // Token ID
  multiplier?: number;       // 1.0, 1.2, 1.5
  multiplierSource?: string; // "NAPC", "BASE", etc.
  seasonPoints?: number;     // User's season points
  width: number;             // Total width (390px)
}

export default function HUD({
  pickaxeType,
  pickaxeId,
  multiplier = 1.0,
  multiplierSource = "BASE",
  seasonPoints = 0,
  width,
}: HUDProps) {
  const panelWidth = Math.floor(width / 4) - 4; // 4 panels with small gaps
  const panelHeight = 60;

  // Format pickaxe display name
  const pickaxeName = pickaxeType 
    ? pickaxeType.replace("The ", "").replace("The Morgul ", "").toUpperCase()
    : "NO PICKAXE";
  
  const pickaxeDisplay = pickaxeId 
    ? `${pickaxeName} #${pickaxeId}`
    : pickaxeName;

  // Format multiplier display
  const multiplierDisplay = multiplier > 1.0 
    ? `${multiplier.toFixed(1)}x ${multiplierSource}`
    : `${multiplier.toFixed(1)}x ${multiplierSource}`;

  // Format season points
  const pointsDisplay = seasonPoints.toLocaleString();

  return (
    <div
      style={{
        width: `${width}px`,
        height: `${panelHeight + 20}px`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 0',
        gap: '4px',
        backgroundColor: '#000',
      }}
    >
      {/* Panel 1: Pickaxe Type/ID */}
      <LCDPanel
        label="PICKAXE"
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
