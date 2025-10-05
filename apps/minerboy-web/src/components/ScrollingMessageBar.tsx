"use client";
import React, { useEffect, useState, useRef } from 'react';

interface ScrollingMessageBarProps {
  messages: string[];
  width: number;
  height?: number;
  speed?: number; // pixels per second
  messageGap?: number; // gap between messages in pixels
}

export default function ScrollingMessageBar({
  messages,
  width,
  height = 20,
  speed = 50, // default 50px per second
  messageGap = 100, // default 100px gap between messages
}: ScrollingMessageBarProps) {
  const [offset, setOffset] = useState(0);
  const textRef = useRef<HTMLDivElement>(null);

  // Join all messages with gaps
  const fullText = messages.join(' '.repeat(Math.floor(messageGap / 7))); // Approximate character spacing

  useEffect(() => {
    const interval = setInterval(() => {
      setOffset((prev) => {
        // Get the width of the text element
        const textWidth = textRef.current?.offsetWidth || 0;
        
        // Reset when we've scrolled past the first copy
        if (prev >= textWidth + messageGap) {
          return 0;
        }
        
        return prev + 1;
      });
    }, 1000 / speed); // Update based on speed

    return () => clearInterval(interval);
  }, [speed, messageGap]);

  return (
    <div
      style={{
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: '#0b2f18', // Dark green
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        ref={textRef}
        style={{
          position: 'absolute',
          whiteSpace: 'nowrap',
          color: '#64ff8a', // Bright green
          fontSize: 12,
          fontFamily: 'Menlo, monospace',
          letterSpacing: 1,
          lineHeight: `${height}px`,
          transform: `translateX(${width - offset}px)`,
          willChange: 'transform',
        }}
      >
        {fullText}
        {/* Duplicate for seamless loop */}
        <span style={{ marginLeft: `${messageGap}px` }}>{fullText}</span>
      </div>
    </div>
  );
}
