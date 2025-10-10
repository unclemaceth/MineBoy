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
import { useWalletModal } from '@/state/walletModal';
import { useActiveAccount } from '@/hooks/useActiveAccount';
import { playButtonSound } from '@/lib/sounds';
import { getOwnedCartridges, type OwnedCartridge } from '@/lib/alchemy';
import { api, apiGetIndividualLeaderboard } from "@/lib/api";

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
  
  // Layout state + persistence
  const [layout, setLayout] = useState<MineBoyLayout>(() => {
    if (typeof window === 'undefined') return 'carousel';
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
  // DEVICE SCALING - Handle responsive scaling based on layout mode
  // =========================================================================
  
  useEffect(() => {
    // Dynamic dimensions based on layout mode
    // ALWAYS include side panels (97.5 + 97.5 = 195px)
    // Carousel: side panels + 1 device
    // Row: side panels + 3 devices side by side with gaps
    // Column: side panels + 3 devices stacked vertically with gaps
    const numDevices = devices.length;
    const SIDE_PANELS = 195; // 97.5 left + 97.5 right
    
    const TOTAL_W = layout === 'carousel' 
      ? 585 // 97.5 + 390 + 97.5
      : layout === 'row'
      ? SIDE_PANELS + (390 * numDevices + 12 * (numDevices - 1)) // side panels + devices side by side with gaps
      : 585; // same as carousel (single device width + side panels)
    
    const TOTAL_H = layout === 'column'
      ? (924 * numDevices + 12 * (numDevices - 1)) // devices stacked with gaps
      : 924; // single device height in carousel/row
    
    function fitDevice() {
      const scaleRaw = Math.min(window.innerWidth / TOTAL_W, window.innerHeight / TOTAL_H);
      const scale = Math.min(1, scaleRaw); // cap to 1 to prevent upscaling blur
      document.documentElement.style.setProperty('--device-scale', String(scale));
      console.log('[Scale] Layout:', layout, 'Dimensions:', TOTAL_W, 'x', TOTAL_H, 'Scale:', scale.toFixed(3));
    }
    
    // RAF throttling for smooth resize
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fitDevice);
    };
    
    fitDevice(); // Initial calculation
    window.addEventListener('resize', onResize, { passive: true });
    
    return () => { 
      cancelAnimationFrame(raf); 
      window.removeEventListener('resize', onResize); 
    };
  }, [layout, devices.length]);
  
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
      position: 'fixed',
      inset: 0,
      display: 'grid',
      placeItems: 'center',
      background: '#0b0b0b',
      overflow: 'hidden',
    }}>
      {/* Always show carousel view - no landing page */}
      {(
        // Scaling wrapper - dimensions change based on layout to fit all devices
        <div
          style={{
            width: layout === 'carousel' 
              ? 585 
              : layout === 'row'
              ? (390 * devices.length + 12 * (devices.length - 1))
              : 390,
            height: layout === 'column'
              ? (924 * devices.length + 12 * (devices.length - 1))
              : 924,
            transformOrigin: 'top left',
            transform: 'scale(var(--device-scale, 1))',
            position: 'relative',
            display: 'flex',
            gap: 0,
          }}
        >
          {/* Left Panel: ALWAYS visible */}
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

          {/* MineBoy Device(s) - size depends on layout */}
          <MineBoyCarousel
            ref={carouselRef}
            devices={devices}
            layout={layout}
            vaultAddress={vaultAddress}
            onEject={handleEjectDevice}
            playButtonSound={playButtonSound}
            onOpenWalletModal={openWalletConnectionModal}
            onOpenWalletManagementModal={() => setShowWalletModal(true)}
            onOpenNavigationModal={openNavigationPage}
            onCartridgeSelected={handleAlchemyCartridgeSelect}
          />
      
          {/* Right Panel: ALWAYS visible */}
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
              </div>
      )}
      
      {/* Global Modals - z-index 3000+ to render above all devices */}
      <NavigationModal
        isOpen={showNavigationModal}
        page={navigationPage}
        onClose={closeNavigationModal}
      />

      <RelayBridgeModalSDK
        isOpen={showRelayModal}
        onClose={() => setShowRelayModal(false)}
        suggestedAmount="0.01"
      />

      <WalletModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
      />
            </div>
  );
}

export default dynamic(() => Promise.resolve(MineBoyOrchestrator), { ssr: false });
