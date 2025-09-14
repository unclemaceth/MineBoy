"use client";

export default function FanWidget({ 
  spinning, 
  size = 100 
}: {
  spinning: boolean; 
  size?: number;
}) {
  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      {/* bottom disc */}
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute" }}>
        <circle cx="50" cy="50" r="50" fill="black" />
      </svg>
      
      {/* blades */}
      <svg
        width={size} 
        height={size} 
        viewBox="0 0 100 100"
        style={{
          position: "absolute",
          animation: spinning ? "spin 1.4s linear infinite" : "none",
        }}
      >
        <g fill="#7aa1e8">
          <path d="M50 10 L58 38 L42 38 Z" />
          <path d="M50 10 L58 38 L42 38 Z" transform="rotate(90 50 50)" />
          <path d="M50 10 L58 38 L42 38 Z" transform="rotate(180 50 50)" />
          <path d="M50 10 L58 38 L42 38 Z" transform="rotate(270 50 50)" />
        </g>
      </svg>
      
      {/* grill */}
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute" }}>
        <circle cx="50" cy="50" r="48" fill="none" stroke="#a3b9ed" strokeWidth="2" />
        {[1, 2, 3, 4, 5].map(i => (
          <circle key={i} cx="50" cy="50" r={i * 8} fill="none" stroke="#4457a8" strokeWidth="1" />
        ))}
      </svg>
      
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
