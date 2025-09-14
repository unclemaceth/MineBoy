"use client";
import React from "react";

export default function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div className="stage">
      <div className="stage__device">
        {children}
      </div>
    </div>
  );
}
