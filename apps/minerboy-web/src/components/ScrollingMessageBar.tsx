"use client";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

interface Message {
  text: string;
  color?: string;
  prefix?: string;
}

interface ScrollingMessageBarProps {
  messages: (string | Message)[];
  width: number;
  height?: number;
  speed?: number;      // pixels per second
  messageGap?: number; // desired gap between messages
  loopPause?: number;  // kept for backward compat, not used
}

export default function ScrollingMessageBar({
  messages,
  width,
  height = 20,
  speed = 50,
  messageGap = 200,
}: ScrollingMessageBarProps) {
  const [offset, setOffset] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const textRef = useRef<HTMLDivElement>(null);

  // Ensure next message doesn't appear until previous fully exits
  const gap = Math.max(messageGap, width);

  // Measure width of the first block (the first <span> inside textRef)
  useLayoutEffect(() => {
    const measure = () => {
      if (!textRef.current) return;
      const first = textRef.current.firstElementChild as HTMLElement | null;
      if (!first) return;
      const w = Math.ceil(first.getBoundingClientRect().width);
      if (w !== textWidth) setTextWidth(w);
    };

    measure();

    // Re-measure on font load & resize
    // (font metrics can change width after initial paint)
    if (typeof document !== 'undefined' && 'fonts' in document) {
      const fonts = (document as any).fonts;
      if (fonts?.ready) {
        fonts.ready.then(measure).catch(() => {});
      }
    }

    const ro = new ResizeObserver(measure);
    if (textRef.current) ro.observe(textRef.current);
    return () => ro.disconnect();
  }, [messages, height, width, gap, textWidth]); // re-measure when these change

  // Smooth continuous loop with RAF
  useEffect(() => {
    if (!textWidth) return;
    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = (now - last) / 1000; // seconds
      last = now;

      setOffset((prev) => {
        const next = prev + speed * dt;
        // Must travel: banner width + block width + trailing gap
        const cycle = width + textWidth + gap;
        return next >= cycle ? next - cycle : next;
      });

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [speed, width, gap, textWidth]);

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: "#0b2f18", // Dark green
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        ref={textRef}
        style={{
          position: "absolute",
          whiteSpace: "nowrap",
          fontSize: 12,
          fontFamily: "Menlo, monospace",
          letterSpacing: 1,
          lineHeight: `${height}px`,
          transform: `translateX(${width - offset}px)`,
          willChange: "transform",
        }}
      >
        {/* First block (sequence of messages) */}
        <span>
          {messages.map((msg, i) => {
            const isStructured = typeof msg === 'object';
            const text = isStructured ? `${msg.prefix || ''}${msg.text}` : msg;
            const color = isStructured ? (msg.color || '#64ff8a') : '#64ff8a';
            
            return (
              <React.Fragment key={`msg-${i}`}>
                <span style={{ color }}>{text}</span>
                {i < messages.length - 1 && (
                  <span style={{ display: "inline-block", width: gap }} />
                )}
              </React.Fragment>
            );
          })}
        </span>

        {/* Trailing gap before the duplicate block */}
        <span style={{ display: "inline-block", width: gap }} />

        {/* Duplicate block for seamless looping */}
        <span>
          {messages.map((msg, i) => {
            const isStructured = typeof msg === 'object';
            const text = isStructured ? `${msg.prefix || ''}${msg.text}` : msg;
            const color = isStructured ? (msg.color || '#64ff8a') : '#64ff8a';
            
            return (
              <React.Fragment key={`msg-dup-${i}`}>
                <span style={{ color }}>{text}</span>
                {i < messages.length - 1 && (
                  <span style={{ display: "inline-block", width: gap }} />
                )}
              </React.Fragment>
            );
          })}
        </span>
      </div>
    </div>
  );
}