"use client";

import { PropsWithChildren } from "react";

export interface DeviceModalProps {
  isOpen: boolean;
  onClose?: () => void;
  // relative to the MineBoyDevice root (not the page)
  zIndex?: number; // base 900; nested 910+
  ariaLabel?: string;
}

export default function DeviceModal({
  isOpen,
  onClose,
  zIndex = 900,
  ariaLabel = "MineBoy modal",
  children,
}: PropsWithChildren<DeviceModalProps>) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={onClose}
      style={{
        position: "absolute",
        // full device pane INCLUDING HUD overlay so it feels like "on the GameBoy"
        inset: 0,
        zIndex,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.75)",
        // the MineBoy shell scales via a parent; absolute here scales with it 👍
        pointerEvents: "auto",
      }}
    >
      <div
        // stop overlay clicks from closing content
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 340,
          maxHeight: "88%",
          width: "min(92%, 340px)",
          overflow: "auto",
          borderRadius: 12,
          border: "3px solid #4a7d5f",
          background: "linear-gradient(180deg, #0f2216, #1a3d24)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

