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
  messageGap = 200, // default 200px gap between messages
}: ScrollingMessageBarProps) {
  const [offset, setOffset] = useState(0);
  const textRef = useRef<HTMLDivElement>(null);
  const [textWidth, setTextWidth] = useState(0);

  // Measure text width when messages change
  useEffect(() => {
    if (textRef.current) {
      // Get the actual width of the first text block (not including duplicate)
      const firstChild = textRef.current.firstChild as HTMLElement;
      if (firstChild) {
        setTextWidth(firstChild.offsetWidth);
      }
    }
  }, [messages]);

  useEffect(() => {
    if (textWidth === 0) return; // Wait for measurement
    
    const interval = setInterval(() => {
      setOffset((prev) => {
        // Reset when we've scrolled the full width of one text block + gap
        // This creates a seamless loop
        if (prev >= textWidth + messageGap) {
          return 0;
        }
        
        return prev + 1;
      });
    }, 1000 / speed); // Update based on speed

    return () => clearInterval(interval);
  }, [speed, messageGap, textWidth]);

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
        {/* First copy with proper gaps between messages */}
        <span>
          {messages.map((msg, i) => (
            <React.Fragment key={`msg-${i}`}>
              {msg}
              {i < messages.length - 1 && <span style={{ display: 'inline-block', width: `${messageGap}px` }} />}
            </React.Fragment>
          ))}
        </span>
        {/* Gap before duplicate */}
        <span style={{ display: 'inline-block', width: `${messageGap}px` }} />
        {/* Duplicate for seamless loop */}
        <span>
          {messages.map((msg, i) => (
            <React.Fragment key={`msg-dup-${i}`}>
              {msg}
              {i < messages.length - 1 && <span style={{ display: 'inline-block', width: `${messageGap}px` }} />}
            </React.Fragment>
          ))}
        </span>
      </div>
    </div>
  );
}
