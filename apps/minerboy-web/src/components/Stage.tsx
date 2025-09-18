"use client";
import React, { useEffect, useRef, useState } from "react";

type Props = {
  children: React.ReactNode;
  width?: number;
  height?: number;
  fullscreen?: boolean;
  className?: string;
  style?: React.CSSProperties;
  ignoreKeyboardResize?: boolean; // default true
  maxScale1?: boolean;            // default true
};

export default function Stage({
  children,
  width = 390,
  height = 844,
  fullscreen = true,
  className,
  style,
  ignoreKeyboardResize = true,
  maxScale1 = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const lastStable = useRef<{w:number; h:number} | null>(null);

  useEffect(() => {
    const px = (v: string) => Number.parseFloat(v || "0") || 0;
    const safe = () => {
      const cs = getComputedStyle(document.documentElement);
      return {
        top: px(cs.getPropertyValue("--safe-top")),
        bottom: px(cs.getPropertyValue("--safe-bottom")),
        left: px(cs.getPropertyValue("--safe-left")),
        right: px(cs.getPropertyValue("--safe-right")),
      };
    };

    const recompute = () => {
      const el = containerRef.current;
      if (!el) return;

      const r = el.getBoundingClientRect();     // layout viewport box of container
      const vv = window.visualViewport || null; // visible viewport (minus browser chrome)
      const s = safe();

      let availW = r.width;
      let availH = r.height;

      if (vv) {
        let vw = vv.width  - s.left - s.right;
        let vh = vv.height - s.top  - s.bottom;

        const active = document.activeElement as HTMLElement | null;
        const keyboardLikelyOpen =
          ignoreKeyboardResize &&
          !!active &&
          (active.tagName === "INPUT" || active.tagName === "TEXTAREA") &&
          vh < window.innerHeight * 0.8;

        if (!keyboardLikelyOpen) {
          lastStable.current = { w: vw, h: vh };
        } else if (lastStable.current) {
          vw = lastStable.current.w;
          vh = lastStable.current.h;
        }

        // Use the smaller of container box and visible viewport
        availW = Math.min(availW, vw);
        availH = Math.min(availH, vh);
      }

      let k = Math.min(availW / width, availH / height);
      if (maxScale1) k = Math.min(k, 1);
      k = Math.round(k * 10000) / 10000; // de-jitter

      setScale(k);
    };

    recompute();
    const onResize = () => recompute();
    const onVVResize = () => recompute();
    const onVVScroll = () => recompute();

    window.addEventListener("resize", onResize, { passive: true });
    window.visualViewport?.addEventListener("resize", onVVResize as any, { passive: true });
    window.visualViewport?.addEventListener("scroll", onVVScroll as any, { passive: true });

    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onVVResize as any);
      window.visualViewport?.removeEventListener("scroll", onVVScroll as any);
    };
  }, [width, height, ignoreKeyboardResize, maxScale1]);

  if (!fullscreen) {
    return (
      <div className={className} style={{ position: "relative", width, height, ...style }}>
        {children}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={className || "stage"} style={{ ...style }}>
      {/* Absolute + translate keeps the *visual* box perfectly centered even when scaled */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width,
          height,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center center",
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </div>
  );
}
