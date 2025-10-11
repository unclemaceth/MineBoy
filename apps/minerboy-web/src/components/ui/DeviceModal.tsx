// DeviceModal - Portaled + Anchored to Device BoundingRect
"use client";

import { PropsWithChildren, useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

type Rect = { left: number; top: number; width: number; height: number };

export interface DeviceModalProps {
  isOpen: boolean;
  onClose?: () => void;
  /** Anchor: the MineBoyDevice root element (can be ForwardedRef or RefObject) */
  anchorRef: React.RefObject<HTMLDivElement> | React.ForwardedRef<HTMLDivElement>;
  ariaLabel?: string;
  closeOnBackdrop?: boolean;
  zIndex?: number; // over everything else
}

export default function DeviceModal({
  isOpen,
  onClose,
  anchorRef,
  ariaLabel = "MineBoy modal",
  closeOnBackdrop = true,
  zIndex = 4000,
  children
}: PropsWithChildren<DeviceModalProps>) {
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // measure + keep overlay synced to device
  const measure = useCallback(() => {
    // Handle both RefObject and ForwardedRef (which can be function or object)
    const el = typeof anchorRef === 'function' ? null : anchorRef?.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
  }, [anchorRef]);

  useLayoutEffect(() => { if (isOpen) measure(); }, [isOpen, measure]);

  useEffect(() => {
    if (!isOpen) return;
    const opts = { passive: true } as const;

    const vv = window.visualViewport;
    const rerun = () => requestAnimationFrame(measure);

    window.addEventListener("resize", rerun, opts);
    window.addEventListener("scroll", rerun, opts);
    window.addEventListener("orientationchange", () => setTimeout(rerun, 60), opts);
    vv?.addEventListener("resize", rerun);
    vv?.addEventListener("scroll", rerun);

    // also re-measure on next frame (iOS toolbar settle)
    const id = requestAnimationFrame(measure);

    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", rerun);
      window.removeEventListener("scroll", rerun);
      window.removeEventListener("orientationchange", rerun as any);
      vv?.removeEventListener("resize", rerun);
      vv?.removeEventListener("scroll", rerun);
    };
  }, [isOpen, measure]);

  // esc + simple focus trap
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => setMounted(true), []);
  if (!mounted || !isOpen || !rect) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={closeOnBackdrop ? onClose : undefined}
      style={{
        position: "fixed",
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        zIndex,
        // backplate that matches device rect only
        background: "rgba(0,0,0,0.70)",
        backdropFilter: "blur(1px)",
        display: "grid",
        placeItems: "center",
        overscrollBehavior: "contain",
        WebkitOverflowScrolling: "touch",
        pointerEvents: "auto"
      }}
    >
      <div
        ref={contentRef}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        style={{
          width: "min(92%, 360px)",
          maxHeight: "min(88%, 560px)",
          overflow: "auto",
          borderRadius: 12,
          border: "3px solid #4a7d5f",
          background: "linear-gradient(180deg,#0f2216,#1a3d24)",
          boxShadow: "0 8px 32px rgba(0,0,0,.6)",
          boxSizing: "border-box",
          padding: 16,
          // IMPORTANT: we are not inside a scaled tree anymore
          transform: "none"
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
