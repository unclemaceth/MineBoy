"use client";
import React from "react";

const DESIGN_W = 1170;
const DESIGN_H = 2532;

export default function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background: "#0b0b0b",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: DESIGN_W,
          height: DESIGN_H,
          transformOrigin: "top left",
          // scale to fit viewport with letterboxing
          // uses CSS variable set on parent via inline script below
          transform: "scale(var(--stage-scale, 1))",
          position: "relative",
          borderRadius: 28,
          boxShadow: "0 20px 80px rgba(0,0,0,0.5)",
          background: "transparent",
        }}
      >
        {children}
      </div>

      {/* compute scale (min fit) */}
      <style>{`
        :root { --stage-scale: 1; }
        @media (min-width: 1px) {
          body:has(#__next) {}
        }
      `}</style>
      <script dangerouslySetInnerHTML={{__html: `
        (function() {
          const DESIGN_W=${DESIGN_W}, DESIGN_H=${DESIGN_H};
          function fit() {
            const s = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
            document.documentElement.style.setProperty('--stage-scale', String(s));
          }
          window.addEventListener('resize', fit, { passive: true });
          fit();
        })();
      `}} />
    </div>
  );
}
