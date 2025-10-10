"use client";

import { createPortal } from "react-dom";
import { useEffect, useState, PropsWithChildren } from "react";

interface PortalProps {
  targetId?: string;
}

/**
 * Portal component to render children outside the React tree
 * Critical for modals inside transformed/scaled wrappers on iOS
 * (iOS Safari makes position:fixed behave like absolute when inside transform)
 */
export default function Portal({ 
  children, 
  targetId = "modal-root" 
}: PropsWithChildren<PortalProps>) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  
  useEffect(() => {
    // Find or create the portal target
    let target = document.getElementById(targetId);
    if (!target) {
      target = document.createElement('div');
      target.id = targetId;
      document.body.appendChild(target);
    }
    setNode(target);
  }, [targetId]);
  
  if (!node) return null;
  
  return createPortal(children, node);
}

