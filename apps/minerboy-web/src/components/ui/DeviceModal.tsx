// DeviceModal - Portaled + Anchored to Device BoundingRect
"use client";

import { PropsWithChildren, useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

type Rect = { left: number; top: number; width: number; height: number };

export interface DeviceModalProps {
  isOpen: boolean;
  onClose?: () => void;
  /** Anchor: the MineBoyDevice root element (always a RefObject, never a callback) */
  anchorRef: React.RefObject<HTMLDivElement | null>;
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
    const el = anchorRef?.current;
    if (!el) {
      console.warn('[DeviceModal] No anchor element found!', { anchorRef });
      return;
    }
    const r = el.getBoundingClientRect();
    const newRect = { left: r.left, top: r.top, width: r.width, height: r.height };
    console.log('[DeviceModal] Measured rect:', newRect);
    setRect(newRect);
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
  
  if (!mounted || !isOpen || !rect) {
    if (isOpen) {
      console.log('[DeviceModal] Not rendering:', { mounted, isOpen, rect });
    }
    return null;
  }

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
        // Backdrop that matches device rect
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(1px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overscrollBehavior: "contain",
        WebkitOverflowScrolling: "touch",
        pointerEvents: "auto"
      }}
    >
      {/* PURE wrapper - NO constraints, children provide their own sizing */}
      <div
        ref={contentRef}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        style={{
          // No width/height constraints - children control their own sizing
          // Only provide a safety maxHeight to prevent overflow
          maxHeight: "min(92%, calc(var(--vh, 100vh) * 0.92))"
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
