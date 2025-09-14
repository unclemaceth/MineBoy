"use client";

export type Dir = "up" | "down" | "left" | "right";

export default function TriDpadButton({ 
  direction, 
  onPress 
}: {
  direction: Dir; 
  onPress?: () => void;
}) {
  const base = { width: 0, height: 0, borderStyle: "solid" as const };
  
  const tri = {
    up:    { ...base, borderWidth: "0 24px 36px 24px",  borderColor: "transparent transparent #4a4a4a transparent" },
    down:  { ...base, borderWidth: "36px 24px 0 24px",  borderColor: "#4a4a4a transparent transparent transparent" },
    left:  { ...base, borderWidth: "24px 36px 24px 0",   borderColor: "transparent #4a4a4a transparent transparent" },
    right: { ...base, borderWidth: "24px 0 24px 36px",   borderColor: "transparent transparent transparent #4a4a4a" },
  }[direction];
  
  return (
    <div 
      role="button"
      onPointerDown={() => { 
        onPress?.(); 
        if (navigator.vibrate) navigator.vibrate(5); 
      }}
      style={{ 
        width: 48, 
        height: 48, 
        display: "grid", 
        placeItems: "center",
        borderRadius: 8, 
        background: "linear-gradient(145deg, #4a4a4a, #1a1a1a)",
        boxShadow: "0 3px 6px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
        cursor: "pointer",
      }}
    >
      <div style={tri} />
    </div>
  );
}
