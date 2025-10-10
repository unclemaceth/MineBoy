"use client";

import { PropsWithChildren, useEffect, useRef, useCallback } from "react";

export interface DeviceModalProps {
  isOpen: boolean;
  onClose?: () => void;
  // relative to the MineBoyDevice root (not the page)
  zIndex?: number; // base 900; nested 910+
  ariaLabel?: string;
  // optional: pass the element that opened the modal so we can restore focus
  returnFocusTo?: HTMLElement | null;
  // optional: finer control
  closeOnBackdrop?: boolean; // default true
}

export default function DeviceModal({
  isOpen,
  onClose,
  zIndex = 900,
  ariaLabel = "MineBoy modal",
  children,
  returnFocusTo,
  closeOnBackdrop = true,
}: PropsWithChildren<DeviceModalProps>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Close on ESC + Focus trap
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
      // simple focus trap: cycle Tab within content
      if (e.key === "Tab" && contentRef.current) {
        const focusables = contentRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
          if (active === first || !contentRef.current.contains(active)) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (active === last || !contentRef.current.contains(active)) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Autofocus first focusable (or content) on open
  useEffect(() => {
    if (!isOpen || !contentRef.current) return;
    const focusables = contentRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    (focusables[0] ?? contentRef.current).focus();
  }, [isOpen]);

  // Restore focus to trigger on close
  useEffect(() => {
    if (!isOpen) return;
    return () => {
      if (returnFocusTo && typeof returnFocusTo.focus === "function") {
        returnFocusTo.focus();
      }
    };
  }, [isOpen, returnFocusTo]);

  // Prevent wheel/touch scroll from escaping the modal box
  const stopScroll = useCallback((e: React.UIEvent) => {
    e.stopPropagation();
  }, []);
  const stopTouch = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
  }, []);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={closeOnBackdrop ? onClose : undefined}
      // NOTE: absolute within the device root so it scales with the MineBoy shell
      style={{
        position: "absolute",
        inset: 0,
        zIndex,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.75)",
        pointerEvents: "auto",
        // avoid scroll chaining to parents
        overscrollBehavior: "contain",
        touchAction: "none",
      }}
    >
      <div
        ref={contentRef}
        // stop overlay clicks/scroll from closing content
        onClick={(e) => e.stopPropagation()}
        onWheel={stopScroll}
        onTouchMove={stopTouch}
        tabIndex={-1}
        style={{
          maxWidth: 340,
          maxHeight: "88%",
          width: "min(92%, 340px)",
          overflow: "auto",
          borderRadius: 12,
          border: "3px solid #4a7d5f",
          background: "linear-gradient(180deg, #0f2216, #1a3d24)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          // make scroll nicer inside
          overscrollBehavior: "contain",
        }}
      >
        {children}
      </div>
    </div>
  );
}

