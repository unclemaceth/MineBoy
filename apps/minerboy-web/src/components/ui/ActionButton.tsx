"use client";
import { useState } from "react";

export default function ActionButton({ 
  label, 
  size = 80, 
  onPress, 
  variant = "primary" 
}: {
  label: string; 
  size?: number; 
  onPress?: () => void; 
  variant?: "primary" | "secondary";
}) {
  const [down, setDown] = useState(false);
  
  const gradient = variant === "primary"
    ? "linear-gradient(145deg, #ff87e5 0%, #ff37c7 50%, #b8008f 100%)"
    : "linear-gradient(145deg, #87b6ff 0%, #378bff 50%, #0050b8 100%)";
    
  return (
    <button
      onPointerDown={() => { 
        setDown(true); 
        onPress?.(); 
        if (navigator.vibrate) navigator.vibrate(10); 
      }}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      style={{
        width: size, 
        height: size, 
        borderRadius: "999px", 
        border: "2px solid",
        borderTopColor: down ? "#1a1a1a" : "#8a8a8a", // top highlight/shadow
        borderLeftColor: down ? "#1a1a1a" : "#8a8a8a", // left highlight/shadow  
        borderRightColor: down ? "#6a6a6a" : "#2a2a2a", // right shadow/highlight
        borderBottomColor: down ? "#6a6a6a" : "#2a2a2a", // bottom shadow/highlight
        cursor: "pointer",
        background: gradient, 
        position: "relative",
        transform: down ? "translateY(3px)" : "translateY(0)",
        transition: "transform 120ms, border-color 120ms",
        boxShadow: down 
          ? "inset 0 3px 4px rgba(0,0,0,0.6)" 
          : "0 3px 3px rgba(0,0,0,0.5)",
      }}
      aria-label={label}
    >
      <span style={{
        position: "absolute", 
        inset: 0, 
        display: "grid", 
        placeItems: "center", 
        fontWeight: 900, 
        fontSize: size * 0.28, 
        color: "#220012", 
        userSelect: "none"
      }}>
        {label}
      </span>
    </button>
  );
}
