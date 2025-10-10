// MineBoyCarousel.tsx - Stacked carousel for 1-3 MineBoy devices
"use client";

import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import MineBoyDevice, { type MineBoyColor } from "./MineBoyDevice";
import { type OwnedCartridge } from '@/lib/alchemy';

export type MineBoyLayout = 'carousel' | 'row' | 'column';

export interface MineBoyCarouselDevice {
  cartridge?: OwnedCartridge; // Optional - device can exist without cartridge
  color: MineBoyColor;
}

export interface MineBoyCarouselProps {
  devices: MineBoyCarouselDevice[];
  layout?: MineBoyLayout; // Layout mode: carousel (stacked), row (horizontal), column (vertical)
  vaultAddress?: string; // Vault address for delegation support
  onVaultChange?: (vault: string) => void; // Callback when vault address changes
  onEject: (index: number) => void;
  playButtonSound?: () => void;
  onOpenWalletModal?: () => void;
  onOpenWalletManagementModal?: () => void;
  onOpenNavigationModal?: (page: 'leaderboard' | 'mint' | 'instructions' | 'welcome') => void;
  onCartridgeSelected?: (cartridge: OwnedCartridge, deviceIndex: number) => void;
  onChangeActive?: (index: number) => void; // Notify parent when active device changes
}

export interface MineBoyCarouselRef {
  goToPrevious: () => void;
  goToNext: () => void;
  goToIndex: (index: number) => void;
  activeIndex: number;
}

/**
 * MineBoyCarousel - Manages multiple MineBoy devices in a stacked carousel
 * 
 * Features:
 * - Stacks up to 3 devices (all stay mounted for background mining)
 * - Arrow navigation (keyboard + buttons)
 * - Swipe gestures on touch devices
 * - Only active device is interactive
 * - Focus management when switching devices
 * - Exposes navigation methods via ref
 */
const MineBoyCarousel = forwardRef<MineBoyCarouselRef, MineBoyCarouselProps>(function MineBoyCarousel({ 
  devices,
  layout = 'carousel',
  vaultAddress,
  onVaultChange,
  onEject, 
  playButtonSound = () => {},
  onOpenWalletModal,
  onOpenWalletManagementModal,
  onOpenNavigationModal,
  onCartridgeSelected,
  onChangeActive
}, ref) {
  
  const mode = layout;
  
  // Restore active index from localStorage on mount
  const [activeIndex, setActiveIndex] = useState(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const saved = localStorage.getItem('mineboy_active_index');
      if (saved) {
        const parsed = parseInt(saved, 10);
        return Math.min(Math.max(0, parsed), devices.length - 1);
      }
    } catch (e) {
      console.warn('[Carousel] Failed to restore active index:', e);
    }
    return 0;
  });
  
  const deviceRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  // Touch/swipe handling
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  
  // ==========================================================================
  // DEVICE REFS SYNC
  // ==========================================================================
  
  // Keep deviceRefs array in sync with devices array length
  useEffect(() => {
    deviceRefs.current.length = devices.length; // truncate or noop
  }, [devices.length]);
  
  // ==========================================================================
  // ACTIVE INDEX PERSISTENCE & NOTIFICATION
  // ==========================================================================
  
  // Persist active index to localStorage and notify parent
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (devices.length === 0) return;
    localStorage.setItem('mineboy_active_index', String(activeIndex));
    onChangeActive?.(activeIndex);
  }, [activeIndex, onChangeActive, devices.length]);
  
  // ==========================================================================
  // ACTIVE INDEX BOUNDS CHECKING
  // ==========================================================================
  
  // Clamp activeIndex when devices array changes OR layout changes
  useEffect(() => {
    setActiveIndex(prev => Math.min(prev, Math.max(0, devices.length - 1)));
  }, [devices.length, mode]);
  
  // ==========================================================================
  // DEVICE STATE ANALYTICS
  // ==========================================================================
  
  // Emit analytics when device configuration changes
  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).gtag) return;
    (window as any).gtag('event', 'carousel_state', {
      device_count: devices.length,
      colors: devices.map(d => d.color).join(','),
      layout: mode,
    });
  }, [devices, mode]);
  
  // ==========================================================================
  // NAVIGATION HANDLERS
  // ==========================================================================
  
  const goToPrevious = useCallback(() => {
    if (devices.length <= 1) return;
    playButtonSound();
    
    // Compute previous index first for analytics
    const prev = activeIndex > 0 ? activeIndex - 1 : devices.length - 1;
    
    // Analytics with correct indices
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'carousel_switch', {
        from_index: activeIndex,
        to_index: prev,
        direction: 'prev',
      });
    }
    
    setActiveIndex(prev);
  }, [devices.length, activeIndex, playButtonSound]);
  
  const goToNext = useCallback(() => {
    if (devices.length <= 1) return;
    playButtonSound();
    
    // Compute next index first for analytics
    const next = activeIndex < devices.length - 1 ? activeIndex + 1 : 0;
    
    // Analytics with correct indices
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'carousel_switch', {
        from_index: activeIndex,
        to_index: next,
        direction: 'next',
      });
    }
    
    setActiveIndex(next);
  }, [devices.length, activeIndex, playButtonSound]);
  
  const goToIndex = useCallback((index: number) => {
    if (index < 0 || index >= devices.length || index === activeIndex) return;
    playButtonSound();
    setActiveIndex(index);
    
    // Analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'carousel_switch', {
        from_index: activeIndex,
        to_index: index,
        direction: 'direct',
      });
    }
  }, [devices.length, activeIndex, playButtonSound]);
  
  // Expose navigation methods and state via ref
  useImperativeHandle(ref, () => ({
    goToPrevious,
    goToNext,
    goToIndex,
    activeIndex,
  }), [goToPrevious, goToNext, goToIndex, activeIndex]);
  
  // ==========================================================================
  // KEYBOARD NAVIGATION
  // ==========================================================================
  
  useEffect(() => {
    // Only enable global arrow keys in carousel mode
    if (mode !== 'carousel') return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle arrow keys for carousel navigation if:
      // 1. Focus is NOT inside ANY MineBoy device (let device handle its D-pad)
      // 2. Multiple devices exist
      if (devices.length <= 1) return;
      
      // Check if focus is inside any device
      const anyContainsFocus = deviceRefs.current.some(
        el => el && el.contains(document.activeElement)
      );
      
      // If focus is inside any device, let it handle arrows (D-pad)
      if (anyContainsFocus) return;
      
      // Otherwise, carousel can handle navigation
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNext();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, goToPrevious, goToNext, devices.length]);
  
  // ==========================================================================
  // FOCUS MANAGEMENT
  // ==========================================================================
  
  useEffect(() => {
    // Move focus to the active device when index or layout changes
    // Only focus if the element is focusable (tabIndex >= 0)
    const el = deviceRefs.current[activeIndex] ?? deviceRefs.current[0];
    if (!el) return;
    if (el.tabIndex >= 0 && document.activeElement !== el) {
      el.focus();
    }
  }, [activeIndex, mode]);
  
  // ==========================================================================
  // VAULT ADDRESS CHANGE HANDLING
  // ==========================================================================
  
  // Keep focus on active device when vault address changes
  useEffect(() => {
    if (!vaultAddress) return;
    const el = deviceRefs.current[activeIndex];
    if (el && el.tabIndex >= 0) {
      el.focus();
    }
  }, [vaultAddress, activeIndex]);
  
  // ==========================================================================
  // TOUCH/SWIPE GESTURES
  // ==========================================================================
  
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);
  
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;
    
    // Dynamic swipe threshold (12% of width, clamped between 30-80px)
    const threshold = Math.max(30, Math.min(80, e.currentTarget.clientWidth * 0.12));
    
    // Only trigger if horizontal swipe is dominant (not vertical scroll)
    if (Math.abs(deltaX) > threshold && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > 0) {
        // Swipe right = previous
        goToPrevious();
      } else {
        // Swipe left = next
        goToNext();
      }
    }
    
    touchStartX.current = null;
    touchStartY.current = null;
  }, [goToPrevious, goToNext]);
  
  // ==========================================================================
  // MOUNT ANALYTICS
  // ==========================================================================
  
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'carousel_mount', {
        device_count: devices.length,
        colors: devices.map(d => d.color).join(','),
      });
    }
  }, []); // Only on mount
  
  // ==========================================================================
  // RENDER
  // ==========================================================================
  
  // Row/Column modes: all devices visible at once, no scroll
  if (mode !== 'carousel') {
    const isRow = mode === 'row';
    // Calculate total dimensions to show all 3 devices
    const totalWidth = isRow ? (390 * devices.length + 12 * (devices.length - 1)) : 390;
    const totalHeight = isRow ? 924 : (924 * devices.length + 12 * (devices.length - 1));
    
    return (
      <div 
        role="region"
        aria-roledescription="MineBoy layout"
        aria-label={mode === 'row' ? 'Row' : 'Column'}
        aria-live="polite"
        style={{ 
          position: 'relative', 
          width: totalWidth, 
          height: totalHeight,
          display: 'flex',
          flexDirection: isRow ? 'row' : 'column',
          touchAction: 'auto', // Allow natural scrolling in row/column
          gap: 12,
        }}
      >
        {devices.map((device, index) => {
          const stableKey = device.cartridge?.tokenId
            ? `${device.color}-${device.cartridge.tokenId}`
            : `${device.color}-empty-${index}`;
          return (
            <div
              key={stableKey}
              aria-label={`MineBoy ${index + 1} of ${devices.length}`}
              style={{
                width: 390,
                height: 924,
                flexShrink: 0,
              }}
            >
              <MineBoyDevice
                ref={(el) => { deviceRefs.current[index] = el; }}
                cartridge={device.cartridge}
                color={device.color}
                isActive={true} // All interactive in row/column mode
                vaultAddress={vaultAddress}
                onVaultChange={onVaultChange}
                onEject={() => onEject(index)}
                playButtonSound={playButtonSound}
                onOpenWalletModal={onOpenWalletModal}
                onOpenWalletManagementModal={onOpenWalletManagementModal}
                onOpenNavigationModal={onOpenNavigationModal}
                onCartridgeSelected={(cart) => onCartridgeSelected && onCartridgeSelected(cart, index)}
              />
            </div>
          );
        })}
      </div>
    );
  }
  
  // Carousel mode: stacked, swipeable
  // Always render from devices array (never empty)
  // Hide navigation if only one device
  const showNavigation = devices.length > 1;
  
  // Stable z-stack for non-active devices (active gets 100, others keep their relative depth)
  const baseZ = devices.map((_, i) => i + 1); // 1..N
  
  return (
    <div
      role="region"
      aria-roledescription="MineBoy layout"
      aria-label="Carousel"
      aria-live="polite"
      style={{
        position: 'relative',
        width: 390,
        height: 924, // Full device height (HUD is already part of MineBoyDevice)
        flexShrink: 0, // Don't shrink in parent flexbox
        touchAction: 'pan-y', // Avoid browser guessing horizontal scroll gestures
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Stacked MineBoy devices - all stay mounted */}
      {devices.map((device, index) => {
        const isActive = index === activeIndex;
        // Use stable key based on color + tokenId, with index salt for empty slots
        const stableKey = device.cartridge?.tokenId
          ? `${device.color}-${device.cartridge.tokenId}`
          : `${device.color}-empty-${index}`;
        return (
          <div
            key={stableKey}
            aria-label={`MineBoy ${index + 1} of ${devices.length}`}
            aria-hidden={!isActive}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: isActive ? 100 : baseZ[index], // Active gets 100, others keep relative depth
              pointerEvents: isActive ? 'auto' : 'none', // Only active device receives clicks
            }}
          >
            <MineBoyDevice
              ref={(el) => { deviceRefs.current[index] = el; }}
              cartridge={device.cartridge}
              color={device.color}
              isActive={isActive}
              vaultAddress={vaultAddress}
              onVaultChange={onVaultChange}
              onEject={() => onEject(index)}
              playButtonSound={playButtonSound}
              onOpenWalletModal={onOpenWalletModal}
              onOpenWalletManagementModal={onOpenWalletManagementModal}
              onOpenNavigationModal={onOpenNavigationModal}
              onCartridgeSelected={(cart) => onCartridgeSelected && onCartridgeSelected(cart, index)}
            />
          </div>
        );
      })}
    </div>
  );
});

export default MineBoyCarousel;
