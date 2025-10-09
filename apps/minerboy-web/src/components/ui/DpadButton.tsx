"use client";
import { useState } from "react";

export type DpadDirection = "up" | "down" | "left" | "right";

export default function DpadButton({ 
  direction, 
  size = 48, 
  onPress 
}: {
  direction: DpadDirection; 
  size?: number; 
  onPress?: () => void;
}) {
  const [down, setDown] = useState(false);
  const [hover, setHover] = useState(false);
  
  // Arrow triangle styles for each direction
  const base = { width: 0, height: 0, borderStyle: "solid" as const };
  const arrowSize = size * 0.25; // 25% of button size
  
  const arrow = {
    up:    { ...base, borderWidth: `0 ${arrowSize/2}px ${arrowSize}px ${arrowSize/2}px`,  borderColor: "transparent transparent #666 transparent" },
    down:  { ...base, borderWidth: `${arrowSize}px ${arrowSize/2}px 0 ${arrowSize/2}px`,  borderColor: "#666 transparent transparent transparent" },
    left:  { ...base, borderWidth: `${arrowSize/2}px ${arrowSize}px ${arrowSize/2}px 0`,   borderColor: "transparent #666 transparent transparent" },
    right: { ...base, borderWidth: `${arrowSize/2}px 0 ${arrowSize/2}px ${arrowSize}px`,   borderColor: "transparent transparent transparent #666" },
  }[direction];
    
  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setDown(false); }}
      onPointerDown={() => { 
        setDown(true); 
        onPress?.(); 
      }}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      style={{
        width: size, 
        height: size, 
        borderRadius: 8, 
        border: down 
          ? "2px solid #1a1a1a" // dark border when pressed
          : "2px solid #6a6a6a", // light border when not pressed
        borderTopColor: down ? "#1a1a1a" : "#8a8a8a", // top highlight/shadow
        borderLeftColor: down ? "#1a1a1a" : "#8a8a8a", // left highlight/shadow  
        borderRightColor: down ? "#6a6a6a" : "#2a2a2a", // right shadow/highlight
        borderBottomColor: down ? "#6a6a6a" : "#2a2a2a", // bottom shadow/highlight
        cursor: "pointer",
        background: hover && !down ? "linear-gradient(145deg, #5a5a5a, #2a2a2a)" : "linear-gradient(145deg, #4a4a4a, #1a1a1a)", 
        position: "relative",
        transform: down ? "translateY(3px) scale(1)" : (hover ? "translateY(0) scale(1.02)" : "translateY(0) scale(1)"),
        transition: "all 0.1s ease",
        boxShadow: down 
          ? "inset 0 2px 3px rgba(0,0,0,0.6)" 
          : "0 2px 2px rgba(0,0,0,0.5)",
        display: "grid",
        placeItems: "center",
      }}
      aria-label={`D-pad ${direction}`}
    >
      <div style={arrow} />
    </button>
  );
}
