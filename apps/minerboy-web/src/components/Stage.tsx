"use client";
import React, { useEffect, useRef, useState } from "react";

type Props = {
  children: React.ReactNode;
  width?: number;   // logical device size
  height?: number;
  fullscreen?: boolean; // default true
  className?: string;
  style?: React.CSSProperties;
  /** ignore keyboard resize so stage doesn't bounce when typing */
  ignoreKeyboardResize?: boolean;
  /** never scale above 1 (keeps pixels crisp on large monitors) */
  maxScale1?: boolean;
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
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const recompute = () => {
      const el = wrapRef.current;
      if (!el) return;

      // container rect (includes padding)
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const padX =
        (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const padY =
        (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);

      // available space inside the container box
      let availW = r.width - padX;
      let availH = r.height - padY;

      // iOS/Android: use VisualViewport so we don't include the URL bar / toolbars
      const vv = window.visualViewport;
      if (vv) {
        let vvH = vv.height; // excludes top/bottom browser chrome
        // When the keyboard is up, vv.height shrinks a lot — optionally ignore
        if (ignoreKeyboardResize) {
          const active = document.activeElement as HTMLElement | null;
          const typing =
            active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");
          if (!typing) {
            availH = Math.min(availH, vvH);
          }
        } else {
          availH = Math.min(availH, vvH);
        }
      }

      let s = Math.min(availW / width, availH / height);
      if (maxScale1) s = Math.min(s, 1);
      // round a tiny bit to reduce jitter
      s = Math.max(0, Math.floor(s * 10000) / 10000);

      setScale(s);
    };

    // first compute and on changes
    recompute();

    // changes from resizing, URL bar show/hide, PWA orientation, etc.
    const onWinResize = () => recompute();
    const onVVResize = () => recompute();
    const onVVScroll = () => recompute(); // Safari toggles bars on scroll

    window.addEventListener("resize", onWinResize, { passive: true });
    window.visualViewport?.addEventListener("resize", onVVResize as any, {
      passive: true,
    });
    window.visualViewport?.addEventListener("scroll", onVVScroll as any, {
      passive: true,
    });

    return () => {
      window.removeEventListener("resize", onWinResize);
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
    <div
      ref={wrapRef}
      className={className || "stage"}
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        // Keep out of iOS notches/home indicator (PWA + Safari)
        paddingTop: "env(safe-area-inset-top)",
        paddingRight: "env(safe-area-inset-right)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        // No scrolling/bounce
        overflow: "hidden",
        touchAction: "manipulation",
        ...style,
      }}
    >
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
