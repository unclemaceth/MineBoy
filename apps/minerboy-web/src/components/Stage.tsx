"use client";
import React, { useEffect, useRef, useState } from "react";

type Props = {
  children: React.ReactNode;
  width?: number;   // device logical width (e.g. 390)
  height?: number;  // device logical height (e.g. 844)
  fullscreen?: boolean; // default true
  className?: string;
  style?: React.CSSProperties;
  ignoreKeyboardResize?: boolean; // default true
  maxScale1?: boolean; // default true -> never upscale above 1
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
  const lastStableH = useRef<number | null>(null);
  const lastStableW = useRef<number | null>(null);

  useEffect(() => {
    const parsePx = (v: string) => Number.parseFloat(v || "0") || 0;

    const getSafeInsets = () => {
      const root = getComputedStyle(document.documentElement);
      return {
        top: parsePx(root.getPropertyValue("--safe-top")),
        bottom: parsePx(root.getPropertyValue("--safe-bottom")),
        left: parsePx(root.getPropertyValue("--safe-left")),
        right: parsePx(root.getPropertyValue("--safe-right")),
      };
    };

    const recompute = () => {
      const el = containerRef.current;
      if (!el) return;

      const r = el.getBoundingClientRect();
      const vv = window.visualViewport;

      const { top: st, bottom: sb, left: sl, right: sr } = getSafeInsets();

      // Base available area = content box of the container
      let availW = r.width;
      let availH = r.height;

      // Use the *visible* viewport (minus safe areas) when available
      if (vv) {
        let vw = vv.width - sl - sr;
        let vh = vv.height - st - sb;

        // When keyboard is open on mobile, vv.height shrinks dramatically.
        // If we're typing into an input, keep the previous stable size.
        const active = document.activeElement as HTMLElement | null;
        const keyboardLikelyOpen =
          ignoreKeyboardResize &&
          !!active &&
          (active.tagName === "INPUT" || active.tagName === "TEXTAREA") &&
          vh < window.innerHeight * 0.8;

        if (!keyboardLikelyOpen) {
          lastStableH.current = vh;
          lastStableW.current = vw;
        } else {
          vh = lastStableH.current ?? vh;
          vw = lastStableW.current ?? vw;
        }

        availW = Math.min(availW, vw);
        availH = Math.min(availH, vh);
      }

      // Final scale
      let s = Math.min(availW / width, availH / height);
      if (maxScale1) s = Math.min(s, 1);

      // tiny rounding to avoid jitter
      s = Math.floor(s * 10000) / 10000;

      setScale(s);
    };

    recompute();

    const onResize = () => recompute();
    const onVVResize = () => recompute();
    const onScroll = () => recompute();

    window.addEventListener("resize", onResize, { passive: true });
    window.visualViewport?.addEventListener("resize", onVVResize as any, {
      passive: true,
    });
    window.visualViewport?.addEventListener("scroll", onScroll as any, {
      passive: true,
    });

    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onVVResize as any);
      window.visualViewport?.removeEventListener("scroll", onScroll as any);
    };
  }, [width, height, ignoreKeyboardResize, maxScale1]);

  if (!fullscreen) {
    return (
      <div
        className={className}
        style={{ position: "relative", width, height, ...style }}
      >
        {children}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={className || "stage"} style={style}>
      <div
        style={{
          position: "relative",
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </div>
  );
}
