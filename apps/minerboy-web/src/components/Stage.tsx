"use client";
import React from "react";

type Props = {
  children: React.ReactNode;
  width?: number;
  height?: number;
  fullscreen?: boolean; // default true
  className?: string;
  style?: React.CSSProperties;
};

export default function Stage({
  children,
  width = 390,
  height = 844,
  fullscreen = true,
  className,
  style,
}: Props) {
  if (!fullscreen) {
    return (
      <div className={className} style={{ position: "relative", width, height, ...style }}>
        {children}
      </div>
    );
  }

  return (
    <div className={className || "stage"}>
      <div className="stage__device" style={{ width, height }}>
        {children}
      </div>
    </div>
  );
}
