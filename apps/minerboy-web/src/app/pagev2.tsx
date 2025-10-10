// MineBoy Orchestrator V2 - Multi-Device Carousel Support
// Feature Flag: NEXT_PUBLIC_MINEBOY_CAROUSEL
"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from 'next/dynamic';
import Stage from "@/components/Stage";
import MineBoyCarousel, { type MineBoyCarouselRef, type MineBoyLayout } from "@/components/MineBoyCarousel";
import MineBoyDevice, { type MineBoyColor } from "@/components/MineBoyDevice";
import NavigationModal from '@/components/NavigationModal';
import CartridgeSelectionModal from '@/components/CartridgeSelectionModal';
import RelayBridgeModalSDK from '@/components/RelayBridgeModalSDK';
import WalletModal from '@/components/WalletModal';
import Portal from '@/components/Portal';
import { useWalletModal } from '@/state/walletModal';
import { useActiveAccount } from '@/hooks/useActiveAccount';
import { playButtonSound } from '@/lib/sounds';
import { getOwnedCartridges, type OwnedCartridge } from '@/lib/alchemy';
import { api, apiGetIndividualLeaderboard } from "@/lib/api";
import { bindVisualViewportVH, markStandalone } from '@/lib/vh';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface DeviceSlot {
  cartridge?: OwnedCartridge; // Optional - device can exist without cartridge
  color: MineBoyColor;
}

const DEVICE_COLORS: MineBoyColor[] = ['blue', 'orange', 'green'];
const MAX_DEVICES = 3;

// Mock cartridges removed - production mode only

// =============================================================================
// MAIN ORCHESTRATOR COMPONENT
// =============================================================================

function MineBoyOrchestrator() {
  // =========================================================================
  // REFS
  // =========================================================================
  
  const carouselRef = useRef<MineBoyCarouselRef>(null);
  
  // =========================================================================
  // GLOBAL STATE - Shared across all devices
  // =========================================================================
  
  const [scrollingMessages, setScrollingMessages] = useState<Array<string | { text: string; color?: string; prefix?: string; type?: string }>>(["MineBoy™ it Mines stuff!"]);
  const [seasonPoints, setSeasonPoints] = useState<number>(0);
  const [vaultAddress, setVaultAddress] = useState<string>('');
  
  // Modal states
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showNavigationModal, setShowNavigationModal] = useState(false);
  const [navigationPage, setNavigationPage] = useState<'leaderboard' | 'mint' | 'instructions' | 'welcome' | null>(null);
  const [showRelayModal, setShowRelayModal] = useState(false);
  const [showAlchemyCartridges, setShowAlchemyCartridges] = useState(false);
  
  // Device management - Always start with 3 empty devices (blue, orange, green)
  const [devices, setDevices] = useState<DeviceSlot[]>(() => {
    // Clear old device localStorage data (active index is kept)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mineboy_carousel_devices');
    }
    return [
      { color: 'blue' },
      { color: 'orange' },
      { color: 'green' }
    ];
  });
  
  // Detect mobile/tablet
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768; // Mobile/tablet breakpoint
  });
  
  // Layout state + persistence (force carousel on mobile)
  const [layout, setLayout] = useState<MineBoyLayout>(() => {
    if (typeof window === 'undefined') return 'carousel';
    if (window.innerWidth < 768) return 'carousel'; // Force carousel on mobile
    const saved = localStorage.getItem('mineboy_layout') as MineBoyLayout;
    if (saved && ['carousel', 'row', 'column'].includes(saved)) return saved;
    return window.innerWidth >= 900 ? 'row' : 'carousel';
  });
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mineboy_layout', layout);
    }
  }, [layout]);
  
  // =========================================================================
  // VISUAL VIEWPORT HEIGHT - iOS Safari bar handling
  // =========================================================================
  
  useEffect(() => {
    // Mark if running in PWA standalone mode
    markStandalone();
    
    // Bind visualViewport height to --vh CSS var
    // This keeps layout correct when iOS Safari bars expand/collapse
    const cleanup = bindVisualViewportVH();
    
    return cleanup;
  }, []);
  
  // Update mobile state on resize + orientation change
  useEffect(() => {
    const updateMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Force carousel on mobile
      if (mobile && layout !== 'carousel') {
        setLayout('carousel');
      }
    };
    
    // Guard for iOS device rotation jitter - orientation fires before resize
    const onOrientationChange = () => {
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 50);
    };
    
    window.addEventListener('resize', updateMobile, { passive: true });
    window.addEventListener('orientationchange', onOrientationChange, { passive: true });
    
    return () => {
      window.removeEventListener('resize', updateMobile);
      window.removeEventListener('orientationchange', onOrientationChange);
    };
  }, [layout]);
  
  // =========================================================================
  // DEVICE SCALING - Handle responsive scaling based on layout mode
  // =========================================================================
  
  useEffect(() => {
    // Use visualViewport API for accurate iOS dimensions
    // (iOS innerHeight includes toolbars, visualViewport.height doesn't)
    const vv = window.visualViewport;
    
    // Helper to read CSS var as pixels
    const readPx = (v: string) => parseFloat(v || '0') || 0;
    const css = () => getComputedStyle(document.documentElement);
    const safeTop = () => readPx(css().getPropertyValue('--safe-top'));
    const safeBottom = () => readPx(css().getPropertyValue('--safe-bottom'));
    
    function fitDevice() {
      const mobile = window.innerWidth < 768;
      
      // Mobile: scale to fit full screen (375-428px typical mobile width)
      // Desktop: use standard dimensions with side panels
      const BASE_W = mobile ? 390 : 585; // mobile: device only, desktop: device + panels
      const BASE_H = mobile ? 820 : 924; // mobile: shorter for better fit
      
      // Use visualViewport dimensions if available (more accurate on iOS)
      const vw = vv ? vv.width : window.innerWidth;
      const rawVH = vv ? vv.height : window.innerHeight;
      
      // Subtract safe-area insets to match the padding we apply on outer container
      // This ensures the device scales to fit the ACTUAL available space
      const availableVH = Math.max(0, rawVH - safeTop() - safeBottom() - 8);
      
      let scaleRaw: number;
      if (mobile) {
        // Mobile: fit to viewport with some padding
        const padding = 20; // 10px on each side
        scaleRaw = Math.min(
          (vw - padding) / BASE_W,
          (availableVH - padding) / BASE_H
        );
      } else {
        // Desktop: standard scaling
        scaleRaw = Math.min(vw / BASE_W, availableVH / BASE_H);
      }
      
      // Never upscale (blur), but allow natural downscale on small screens
      const scale = Math.min(1, scaleRaw);
      document.documentElement.style.setProperty('--device-scale', String(scale));
      console.log('[Scale] Mobile:', mobile, 'vw:', vw, 'availableVH:', availableVH, 'scale:', scale.toFixed(3));
    }
    
    // First paint, then a second pass after toolbar settles
    requestAnimationFrame(() => {
      fitDevice();
      requestAnimationFrame(fitDevice);
    });
    
    const rerun = () => requestAnimationFrame(fitDevice);
    
    // Listen to all resize events (window, orientation, visualViewport)
    window.addEventListener('resize', rerun, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(rerun, 60), { passive: true });
    vv?.addEventListener('resize', rerun);
    vv?.addEventListener('scroll', rerun); // iOS toolbar show/hide
    
    return () => {
      window.removeEventListener('resize', rerun);
      window.removeEventListener('orientationchange', rerun as any);
      vv?.removeEventListener('resize', rerun);
      vv?.removeEventListener('scroll', rerun);
    };
  }, [layout]);
  
  // Device persistence disabled - always use 3 fixed devices
  // useEffect(() => {
  //   if (typeof window !== 'undefined') {
  //     try {
  //       const devicesToSave = devices.map(d => ({ color: d.color }));
  //       localStorage.setItem('mineboy_carousel_devices', JSON.stringify(devicesToSave));
  //       console.log('[Orchestrator] Saved devices to localStorage:', devicesToSave);
  //     } catch (e) {
  //       console.warn('[Orchestrator] Failed to save devices to localStorage:', e);
  //     }
  //   }
  // }, [devices]);
  
  // =========================================================================
  // WALLET INTEGRATION
  // =========================================================================
  
  const { address, isConnected } = useActiveAccount();
  const { open: openWalletConnectionModal } = useWalletModal();
  
  // =========================================================================
  // NAVIGATION HELPERS
  // =========================================================================
  
  const openNavigationPage = (page: 'leaderboard' | 'mint' | 'instructions' | 'welcome') => {
    setNavigationPage(page);
    setShowNavigationModal(true);
    playButtonSound();
  };

  const closeNavigationModal = () => {
    setShowNavigationModal(false);
    setNavigationPage(null);
    playButtonSound();
  };

  // =========================================================================
  // WELCOME MODAL
  // =========================================================================
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hideWelcome = localStorage.getItem('mineboy_hideWelcome');
      if (!hideWelcome) {
        setTimeout(() => {
          setNavigationPage('welcome');
          setShowNavigationModal(true);
        }, 1000);
      }
    }
  }, []);

  // =========================================================================
  // SINGLE-TAB ENFORCEMENT
  // =========================================================================
  
  useEffect(() => {
    const bc = new BroadcastChannel('mineboy');
    let isLeader = false;

    const onMsg = (e: MessageEvent) => {
      if (e.data === 'hello') {
        // another tab is probing; if we're leader, tell them to bail
        if (isLeader) bc.postMessage('busy');
      } else if (e.data === 'busy') {
        // another tab is already leader
        alert('MineBoy™ already open in another tab. Please close the other tab first.');
        try { window.close(); } catch {}
      }
    };

    bc.onmessage = onMsg;
    // Elect self as leader after a short probe window
    bc.postMessage('hello');
    const t = setTimeout(() => { isLeader = true; }, 300);
    
    return () => {
      clearTimeout(t);
      bc.close();
    };
  }, []);
  
  // =========================================================================
  // FETCH SCROLLING MESSAGES
  // =========================================================================
  
  useEffect(() => {
    let alive = true;
    const fetchMessages = async () => {
      try {
        const response = await api.getMessages();
        if (alive && response && response.messages && response.messages.length > 0) {
          setScrollingMessages(response.messages);
        }
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      }
    };
    
    fetchMessages();
    const interval = setInterval(fetchMessages, 60000); // Refresh every minute
    return () => { alive = false; clearInterval(interval); };
  }, []);

  // =========================================================================
  // FETCH SEASON POINTS
  // =========================================================================
  
  useEffect(() => {
    if (!address) {
      setSeasonPoints(0);
      return;
    }
    
    let alive = true;
    const fetchSeasonPoints = async () => {
    try {
      const response = await apiGetIndividualLeaderboard('active', 100, 0, address);
      if (alive && response.me?.totalMNESTR) {
        const points = Math.floor(parseFloat(response.me.totalMNESTR));
        setSeasonPoints(points);
      } else if (alive) {
        setSeasonPoints(0);
      }
    } catch (error) {
        console.error('Failed to fetch season points:', error);
    }
    };

    fetchSeasonPoints();
    const interval = setInterval(fetchSeasonPoints, 30000); // Refresh every 30s
    return () => { alive = false; clearInterval(interval); };
  }, [address]);
  
  // =========================================================================
  // DEVICE MANAGEMENT - Cartridge selection
  // =========================================================================
  
  const handleAddDevice = () => {
    playButtonSound();
    
    setDevices(prev => {
      if (prev.length >= MAX_DEVICES) {
        alert(`Maximum ${MAX_DEVICES} MineBoys allowed`);
        return prev;
      }
      
      // Calculate color based on current array length
      const nextColor = DEVICE_COLORS[prev.length % DEVICE_COLORS.length];
      const newDevice: DeviceSlot = {
        color: nextColor,
      };
      
      console.log('[Orchestrator] Adding device:', { currentLength: prev.length, nextColor, newDevice });
      return [...prev, newDevice];
    });
  };
  
  const handleAlchemyCartridgeSelect = async (selectedCartridge: OwnedCartridge, deviceIndex: number) => {
    setShowAlchemyCartridges(false);
    
    // Check if cartridge is already in use (check tokenId, chainId, and contract address)
    const alreadyUsed = devices.some(d => 
      d.cartridge &&
      d.cartridge.tokenId === selectedCartridge.tokenId &&
      d.cartridge.contractAddress.toLowerCase() === selectedCartridge.contractAddress.toLowerCase() &&
      d.cartridge.chainId === selectedCartridge.chainId
    );
    if (alreadyUsed) {
      alert('This cartridge is already inserted in another MineBoy');
            return;
          }
          
    // Insert into the specific device that requested it
    setDevices(prev => {
      const updated = [...prev];
      updated[deviceIndex] = {
        ...updated[deviceIndex],
        cartridge: selectedCartridge,
      };
      console.log('[Orchestrator] Updated device at index', deviceIndex, ':', updated[deviceIndex]);
      return updated;
    });
  };
  
  const handleEjectDevice = (index: number) => {
    const device = devices[index];
    console.log('[Orchestrator] Ejecting cartridge from device:', { index, color: device.color, tokenId: device.cartridge?.tokenId });
    
    playButtonSound();
    
    // If device has no cartridge, do nothing
    if (!device.cartridge) {
      console.log('[Orchestrator] Device has no cartridge to eject');
      return;
    }
    
    // Clear the cartridge from this device (keep device, just remove cartridge)
    setDevices(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], cartridge: undefined };
      return updated;
    });
  };
  
  // =========================================================================
  // RENDER
  // =========================================================================

  return (
      <div style={{
      position: 'relative',
      inset: 0,
      display: 'grid',
      placeItems: 'center',
      background: '#0b0b0b',
      overflow: layout === 'carousel' 
        ? 'hidden' 
        : layout === 'row'
        ? 'auto hidden' // horizontal scroll
        : 'hidden auto', // vertical scroll
      width: '100vw',
      height: 'var(--vh)', // Use real visual viewport (updated by bindVisualViewportVH)
      maxHeight: 'var(--vh)',
      paddingTop: 'var(--safe-top)', // Keep clear of notch
      paddingBottom: 'calc(var(--safe-bottom) + 8px)', // Keep clear of home indicator
      WebkitOverflowScrolling: 'touch',
      overscrollBehavior: 'contain',
      // Prevent text selection and zooming on mobile
      userSelect: 'none',
      WebkitUserSelect: 'none',
      WebkitTouchCallout: 'none',
    }}>
      {/* Always show carousel view - no landing page */}
      {(() => {
        // Calculate dimensions using state (not direct window.innerWidth)
        const DEVICE_W = isMobile ? 390 : 585;
        const DEVICE_H = isMobile ? 820 : 924;
        const PANELS = isMobile ? 0 : 195;
        const GAP = 12;

        const contentWidth =
          layout === 'carousel'
            ? PANELS + 390 // device width only
            : layout === 'row'
            ? PANELS + (390 * devices.length + GAP * (devices.length - 1))
            : PANELS + 390;

        const contentHeight =
          layout === 'column'
            ? DEVICE_H * devices.length + GAP * (devices.length - 1)
            : DEVICE_H;

        return (
        // Scaling wrapper - natural content dimensions for scrolling
        <div
              style={{
            width: `${contentWidth}px`,
            height: `${contentHeight}px`,
            maxWidth: '100vw',        // Never overflow viewport
            maxHeight: 'var(--vh)',   // Use real visual viewport (iOS toolbar-safe)
            transformOrigin: 'top center', // Better on phones
            transform: 'scale(var(--device-scale, 1))',
            position: 'relative',
                display: 'flex',
            gap: 0,
          }}
        >
          {/* Left Panel: Desktop only */}
      {!isMobile && (
      <div style={{
            width: 97.5,
            height: 924,
                display: 'flex',
            flexDirection: 'column',
                alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 0',
      }}>
            {/* Top: Left Arrow - only visible in carousel mode */}
            {layout === 'carousel' && (
            <button 
              onClick={() => carouselRef.current?.goToPrevious()}
              disabled={devices.length <= 1 || layout !== 'carousel'}
              aria-disabled={devices.length <= 1 || layout !== 'carousel'}
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: devices.length > 1 && layout === 'carousel'
                  ? 'linear-gradient(145deg, #4a7d5f, #1a3d24)'
                  : 'linear-gradient(145deg, #3a3a3a, #1a1a1a)',
                border: '3px solid',
                borderTopColor: devices.length > 1 && layout === 'carousel' ? '#5a8d6f' : '#4a4a4a',
                borderLeftColor: devices.length > 1 && layout === 'carousel' ? '#5a8d6f' : '#4a4a4a',
                borderRightColor: devices.length > 1 && layout === 'carousel' ? '#2a4d34' : '#2a2a2a',
                borderBottomColor: devices.length > 1 && layout === 'carousel' ? '#2a4d34' : '#2a2a2a',
                color: devices.length > 1 && layout === 'carousel' ? '#c8ffc8' : '#666',
                fontSize: 32,
                fontWeight: 'bold',
                cursor: devices.length > 1 && layout === 'carousel' ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 8px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.2)',
                transition: 'all 0.15s',
                opacity: devices.length > 1 && layout === 'carousel' ? 1 : 0.4,
              }}
              aria-label="Previous MineBoy"
            >
              ‹
            </button>
            )}
            
            {/* Spacer for non-carousel mode */}
            {layout !== 'carousel' && <div style={{ width: 60, height: 60 }} />}

            {/* Bottom: placeholder for future controls */}
            <div style={{ width: 50, height: 50 }} />
                </div>
      )}

          {/* MineBoy Device(s) - size depends on layout */}
          <MineBoyCarousel
            ref={carouselRef}
            devices={devices}
            layout={layout}
        vaultAddress={vaultAddress}
        onVaultChange={setVaultAddress}
            onEject={handleEjectDevice}
        playButtonSound={playButtonSound}
            onOpenWalletModal={openWalletConnectionModal}
            onOpenWalletManagementModal={() => setShowWalletModal(true)}
            onOpenNavigationModal={openNavigationPage}
            onCartridgeSelected={handleAlchemyCartridgeSelect}
      />
      
          {/* Right Panel: Desktop only */}
      {!isMobile && (
        <div style={{
            width: 97.5,
            height: 924,
          display: 'flex',
            flexDirection: 'column',
          alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 0',
          }}>
            {/* Top: Right Arrow - only visible in carousel mode */}
            {layout === 'carousel' && (
              <button
              onClick={() => carouselRef.current?.goToNext()}
              disabled={devices.length <= 1 || layout !== 'carousel'}
              aria-disabled={devices.length <= 1 || layout !== 'carousel'}
                style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: devices.length > 1 && layout === 'carousel'
                  ? 'linear-gradient(145deg, #4a7d5f, #1a3d24)'
                  : 'linear-gradient(145deg, #3a3a3a, #1a1a1a)',
                border: '3px solid',
                borderTopColor: devices.length > 1 && layout === 'carousel' ? '#5a8d6f' : '#4a4a4a',
                borderLeftColor: devices.length > 1 && layout === 'carousel' ? '#5a8d6f' : '#4a4a4a',
                borderRightColor: devices.length > 1 && layout === 'carousel' ? '#2a4d34' : '#2a2a2a',
                borderBottomColor: devices.length > 1 && layout === 'carousel' ? '#2a4d34' : '#2a2a2a',
                color: devices.length > 1 && layout === 'carousel' ? '#c8ffc8' : '#666',
                fontSize: 32,
                  fontWeight: 'bold',
                cursor: devices.length > 1 && layout === 'carousel' ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 8px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.2)',
                transition: 'all 0.15s',
                opacity: devices.length > 1 && layout === 'carousel' ? 1 : 0.4,
              }}
              aria-label="Next MineBoy"
            >
              ›
              </button>
            )}
            
            {/* Spacer for non-carousel mode */}
            {layout !== 'carousel' && <div style={{ width: 60, height: 60 }} />}

            {/* Bottom: Layout toggle + M/I/L buttons - ALWAYS visible */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Layout Toggle */}
                    <button
                      onClick={() => {
                        playButtonSound();
                  setLayout(l => (l === 'carousel' ? 'row' : l === 'row' ? 'column' : 'carousel'));
                      }}
                      style={{
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
                  border: '3px solid #3a8a4d',
                  color: '#c8ffc8',
                  fontSize: 11,
                      fontWeight: 'bold',
                      cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.2)',
                }}
                aria-label="Change layout"
                title={
                  layout === 'carousel' ? 'Layout: Carousel' :
                  layout === 'row' ? 'Layout: Row' : 'Layout: Column'
                }
              >
                {layout === 'carousel' ? 'CAR' : layout === 'row' ? 'ROW' : 'COL'}
                  </button>
            
              {/* Mint */}
            <button
                onClick={() => openNavigationPage('mint')}
              style={{
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
                  border: '3px solid #3a8a4d',
                  color: '#c8ffc8',
                  fontSize: 18,
                      fontWeight: 'bold',
                cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.2)',
                }}
                aria-label="Mint"
              >
                M
              </button>
              <button
                onClick={() => openNavigationPage('instructions')}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
                  border: '3px solid #3a8a4d',
              color: '#c8ffc8',
                  fontSize: 18,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.2)',
                }}
                aria-label="Instructions"
              >
                I
              </button>
                <button
                onClick={() => openNavigationPage('leaderboard')}
                  style={{
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                    background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
                  border: '3px solid #3a8a4d',
                    color: '#c8ffc8',
                  fontSize: 18,
                    fontWeight: 'bold',
                      cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.2)',
                }}
                aria-label="Leaderboard"
              >
                L
                  </button>
                </div>
                </div>
      )}
        </div>
        );
      })()}
      
      {/* Global Modals - Portaled outside scaled wrapper to fix iOS position:fixed */}
      <Portal>
        <NavigationModal
          isOpen={showNavigationModal}
          page={navigationPage}
          onClose={closeNavigationModal}
        />
      </Portal>

      <Portal>
        <RelayBridgeModalSDK
          isOpen={showRelayModal}
          onClose={() => setShowRelayModal(false)}
          suggestedAmount="0.01"
        />
      </Portal>

      <Portal>
        <WalletModal
          isOpen={showWalletModal}
          onClose={() => setShowWalletModal(false)}
        />
      </Portal>
            </div>
  );
}

export default dynamic(() => Promise.resolve(MineBoyOrchestrator), { ssr: false });
