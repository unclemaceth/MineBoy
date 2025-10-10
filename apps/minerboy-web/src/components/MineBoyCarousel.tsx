// MineBoyCarousel.tsx - Stacked carousel for 1-3 MineBoy devices
"use client";

import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import MineBoyDevice, { type MineBoyColor } from "./MineBoyDevice";
import { type OwnedCartridge } from '@/lib/alchemy';

export interface MineBoyCarouselDevice {
  cartridge?: OwnedCartridge; // Optional - device can exist without cartridge
  color: MineBoyColor;
}

export interface MineBoyCarouselProps {
  devices: MineBoyCarouselDevice[];
  onEject: (index: number) => void;
  playButtonSound?: () => void;
  onOpenWalletModal?: () => void;
  onCartridgeSelected?: (cartridge: OwnedCartridge, deviceIndex: number) => void;
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
  onEject, 
  playButtonSound = () => {},
  onOpenWalletModal,
  onCartridgeSelected
}, ref) {
  
  const [activeIndex, setActiveIndex] = useState(0);
  const deviceRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  // Touch/swipe handling
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  
  // ==========================================================================
  // NAVIGATION HANDLERS
  // ==========================================================================
  
  const goToPrevious = useCallback(() => {
    if (devices.length <= 1) return;
    playButtonSound();
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : devices.length - 1));
    
    // Analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'carousel_switch', {
        from_index: activeIndex,
        to_index: activeIndex > 0 ? activeIndex - 1 : devices.length - 1,
        direction: 'prev',
      });
    }
  }, [devices.length, activeIndex, playButtonSound]);
  
  const goToNext = useCallback(() => {
    if (devices.length <= 1) return;
    playButtonSound();
    setActiveIndex((prev) => (prev < devices.length - 1 ? prev + 1 : 0));
    
    // Analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'carousel_switch', {
        from_index: activeIndex,
        to_index: activeIndex < devices.length - 1 ? activeIndex + 1 : 0,
        direction: 'next',
      });
    }
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
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle arrow keys for carousel navigation
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
  }, [goToPrevious, goToNext]);
  
  // ==========================================================================
  // FOCUS MANAGEMENT
  // ==========================================================================
  
  useEffect(() => {
    // Move focus to the active device when index changes
    const activeDevice = deviceRefs.current[activeIndex];
    if (activeDevice && document.activeElement !== activeDevice) {
      activeDevice.focus();
    }
  }, [activeIndex]);
  
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
    
    // Threshold for swipe (40px recommended for mobile)
    const threshold = 40;
    
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
  
  // Always render from devices array (never empty)
  // Hide navigation if only one device
  const showNavigation = devices.length > 1;
  
  return (
    <div
      style={{
        position: 'relative',
        width: 390,
        height: 924, // Full device height (HUD is already part of MineBoyDevice)
        flexShrink: 0, // Don't shrink in parent flexbox
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Stacked MineBoy devices - all stay mounted */}
      {devices.map((device, index) => {
        const isActive = index === activeIndex;
        return (
          <div
            key={`device-${index}`}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: isActive ? 3 : (devices.length - index), // Active on top
              pointerEvents: isActive ? 'auto' : 'none', // Only active device receives clicks
            }}
          >
            <MineBoyDevice
              ref={(el) => { deviceRefs.current[index] = el; }}
              cartridge={device.cartridge}
              color={device.color}
              isActive={isActive}
              onEject={() => onEject(index)}
              playButtonSound={playButtonSound}
              onOpenWalletModal={onOpenWalletModal}
              onCartridgeSelected={(cart) => onCartridgeSelected && onCartridgeSelected(cart, index)}
            />
          </div>
        );
      })}
    </div>
  );
});

export default MineBoyCarousel;
