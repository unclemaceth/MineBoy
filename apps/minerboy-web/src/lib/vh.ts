/**
 * Visual Viewport Height Utility
 * 
 * Keeps --vh CSS var in sync with the REAL visual viewport height.
 * Critical for iOS Safari where collapsing/expanding bars change viewport.
 * 
 * Safari's 100vh includes the toolbar space (too tall)
 * Safari's 100dvh updates but not always in real-time
 * visualViewport.height gives us the actual visible area
 */

/**
 * Mark document as running in iOS PWA standalone mode
 * (different safe-area behavior than in-Safari)
 */
export function markStandalone() {
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // Old iOS PWA signal
    (navigator as any).standalone === true;

  if (isStandalone) {
    document.documentElement.classList.add('standalone');
    document.body.classList.add('standalone');
    console.log('[vh] Running in iOS PWA standalone mode');
  }
}

/**
 * Bind visualViewport height to CSS var --vh
 * Returns cleanup function
 */
export function bindVisualViewportVH() {
  const set = () => {
    // Use visualViewport if available (more accurate on iOS)
    const h = window.visualViewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty('--vh', `${h}px`);
    console.log('[vh] Updated --vh:', h);
  };
  
  // Initial set
  set();
  
  const opts = { passive: true } as const;
  
  // Listen to all events that can change visual viewport
  window.visualViewport?.addEventListener('resize', set, opts);
  window.visualViewport?.addEventListener('scroll', set, opts); // iOS toolbar show/hide
  window.addEventListener('resize', set, opts);
  window.addEventListener('orientationchange', set, opts);
  
  // On back/forward cache restore (iOS)
  window.addEventListener('pageshow', (e: any) => { 
    if (e.persisted) set(); 
  }, opts);
  
  return () => {
    window.visualViewport?.removeEventListener('resize', set as any);
    window.visualViewport?.removeEventListener('scroll', set as any);
    window.removeEventListener('resize', set as any);
    window.removeEventListener('orientationchange', set as any);
    window.removeEventListener('pageshow', set as any);
  };
}

