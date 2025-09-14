"use client";
import { useState } from "react";

export type Dir = "up" | "down" | "left" | "right";

export default function TriDpadButton({ 
  direction, 
  onPress 
}: {
  direction: Dir; 
  onPress?: () => void;
}) {
  const [down, setDown] = useState(false);
  const base = { width: 0, height: 0, borderStyle: "solid" as const };
  
  const tri = {
    up:    { ...base, borderWidth: "0 6px 9px 6px",  borderColor: "transparent transparent #4a4a4a transparent" },
    down:  { ...base, borderWidth: "9px 6px 0 6px",  borderColor: "#4a4a4a transparent transparent transparent" },
    left:  { ...base, borderWidth: "6px 9px 6px 0",   borderColor: "transparent #4a4a4a transparent transparent" },
    right: { ...base, borderWidth: "6px 0 6px 9px",   borderColor: "transparent transparent transparent #4a4a4a" },
  }[direction];
  
  return (
    <div 
      role="button"
      onPointerDown={() => { 
        setDown(true);
        onPress?.(); 
      }}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      style={{ 
        width: 48, 
        height: 48, 
        display: "grid", 
        placeItems: "center",
        borderRadius: 8, 
        background: "linear-gradient(145deg, #4a4a4a, #1a1a1a)",
        boxShadow: down 
          ? "inset 0 3px 8px rgba(0,0,0,0.6)" 
          : "0 4px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
        cursor: "pointer",
        transform: down ? "translateY(3px)" : "translateY(0)",
        transition: "transform 120ms, box-shadow 120ms",
      }}
    >
      <div style={tri} />
    </div>
  );
}
