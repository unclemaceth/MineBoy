// MineBoy Orchestrator V2 - Multi-Device Carousel Support
// Feature Flag: NEXT_PUBLIC_MINEBOY_CAROUSEL
"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from 'next/dynamic';
import Stage from "@/components/Stage";
import MineBoyCarousel, { type MineBoyCarouselRef } from "@/components/MineBoyCarousel";
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
  // DEVICE SCALING - Handle responsive scaling of 390x924 device
  // =========================================================================
  
  useEffect(() => {
    const TOTAL_W = 585; // 97.5 (left panel) + 390 (device) + 97.5 (right panel)
    const TOTAL_H = 924;
    
    function fitDevice() {
      const scale = Math.min(window.innerWidth / TOTAL_W, window.innerHeight / TOTAL_H);
      document.documentElement.style.setProperty('--device-scale', String(scale));
      console.log('[Carousel] Scale:', scale.toFixed(3), 'Viewport:', window.innerWidth, 'x', window.innerHeight);
    }
    
    fitDevice(); // Initial calculation
    window.addEventListener('resize', fitDevice, { passive: true });
    
    return () => window.removeEventListener('resize', fitDevice);
  }, []);
  
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
  const [lockedCartridge, setLockedCartridge] = useState<{ contract: string; tokenId: string; ttl: number; type: 'conflict' | 'timeout' } | null>(null);
  
  // Device management - Always start with 3 empty devices (blue, orange, green)
  const [devices, setDevices] = useState<DeviceSlot[]>([
    { color: 'blue' },
    { color: 'orange' },
    { color: 'green' }
  ]);
  const [availableCartridges, setAvailableCartridges] = useState<OwnedCartridge[]>([]);
  
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
    let hasLeader = false;
    
    bc.onmessage = (e) => { 
      if (e.data === 'hello' && hasLeader) {
        bc.postMessage('busy');
      }
    };
    
    bc.postMessage('hello');
    bc.onmessage = (e) => { 
      if (e.data === 'busy') {
        alert('MineBoy™ already open in another tab. Please close the other tab first.');
        window.close();
      }
    };
    hasLeader = true;
    
    return () => {
      bc.close();
    };
  }, []);
  
  // =========================================================================
  // FETCH SCROLLING MESSAGES
  // =========================================================================
  
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await api.getMessages();
        if (response && response.messages && response.messages.length > 0) {
          setScrollingMessages(response.messages);
        }
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      }
    };
    
    fetchMessages();
    const interval = setInterval(fetchMessages, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);
  
  // =========================================================================
  // FETCH SEASON POINTS
  // =========================================================================
  
  useEffect(() => {
    if (!address) {
      setSeasonPoints(0);
      return;
    }
    
    const fetchSeasonPoints = async () => {
    try {
      const response = await apiGetIndividualLeaderboard('active', 100, 0, address);
      if (response.me?.totalMNESTR) {
        const points = Math.floor(parseFloat(response.me.totalMNESTR));
        setSeasonPoints(points);
      } else {
        setSeasonPoints(0);
      }
      } catch (error) {
        console.error('Failed to fetch season points:', error);
    }
    };

    fetchSeasonPoints();
    const interval = setInterval(fetchSeasonPoints, 30000); // Refresh every 30s
    return () => clearInterval(interval);
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
    
    // Check if cartridge is already in use
    const alreadyUsed = devices.some(d => d.cartridge?.tokenId === selectedCartridge.tokenId);
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
        // Carousel View - All inside one scaling wrapper
        <div
          style={{
            width: 585, // 97.5 (left) + 390 (device) + 97.5 (right)
            height: 924,
            transformOrigin: 'top left',
            transform: 'scale(var(--device-scale, 1))',
            position: 'relative',
            display: 'flex',
            gap: 0,
          }}
        >
          {/* Left Panel: 97.5px x 924px */}
      <div style={{
            width: 97.5,
            height: 924,
        display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 0',
      }}>
            {/* Top: Left Arrow */}
            <button 
              onClick={() => carouselRef.current?.goToPrevious()}
              disabled={devices.length <= 1}
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: devices.length > 1 
                  ? 'linear-gradient(145deg, #4a7d5f, #1a3d24)'
                  : 'linear-gradient(145deg, #3a3a3a, #1a1a1a)',
                border: '3px solid',
                borderTopColor: devices.length > 1 ? '#5a8d6f' : '#4a4a4a',
                borderLeftColor: devices.length > 1 ? '#5a8d6f' : '#4a4a4a',
                borderRightColor: devices.length > 1 ? '#2a4d34' : '#2a2a2a',
                borderBottomColor: devices.length > 1 ? '#2a4d34' : '#2a2a2a',
                color: devices.length > 1 ? '#c8ffc8' : '#666',
                fontSize: 32,
                fontWeight: 'bold',
                cursor: devices.length > 1 ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 8px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.2)',
                transition: 'all 0.15s',
                opacity: devices.length > 1 ? 1 : 0.4,
              }}
              aria-label="Previous MineBoy"
            >
              ‹
            </button>

            {/* Bottom: +/− buttons - DISABLED (always have 3 devices) */}
            {/* <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button 
                onClick={handleAddDevice}
                disabled={devices.length >= MAX_DEVICES}
              style={{
                  width: 50,
                  height: 50,
                borderRadius: '50%',
                  background: devices.length >= MAX_DEVICES 
                    ? 'linear-gradient(145deg, #3a3a3a, #1a1a1a)'
                    : 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
                  border: '3px solid #3a8a4d',
                color: '#c8ffc8',
                  fontSize: 28,
                fontWeight: 'bold',
                  cursor: devices.length >= MAX_DEVICES ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.2)',
                  opacity: devices.length >= MAX_DEVICES ? 0.4 : 1,
                }}
                aria-label="Add MineBoy"
              >
                +
            </button>
            <button 
                onClick={() => {
                  const activeIndex = carouselRef.current?.activeIndex ?? 0;
                  handleEjectDevice(activeIndex);
                }}
              style={{
                  width: 50,
                  height: 50,
                borderRadius: '50%',
                  background: 'linear-gradient(145deg, #7d4a4a, #3d1a1a)',
                  border: '3px solid #8a3a3a',
                  color: '#ffc8c8',
                  fontSize: 28,
                fontWeight: 'bold',
                  cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.2)',
                }}
                aria-label="Remove Active MineBoy"
              >
                −
            </button>
      </div> */}
            </div>

          {/* MineBoy Device: 390px x 924px */}
          <div style={{ width: 390, height: 924, position: 'relative' }}>
            <MineBoyCarousel
              ref={carouselRef}
              devices={devices}
              onEject={handleEjectDevice}
        playButtonSound={playButtonSound}
              onOpenWalletModal={openWalletConnectionModal}
              onOpenWalletManagementModal={() => setShowWalletModal(true)}
              onOpenNavigationModal={openNavigationPage}
              onCartridgeSelected={handleAlchemyCartridgeSelect}
      />
          </div>
      
          {/* Right Panel: 97.5px x 924px */}
        <div style={{
            width: 97.5,
            height: 924,
          display: 'flex',
            flexDirection: 'column',
          alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 0',
          }}>
            {/* Top: Right Arrow */}
              <button
              onClick={() => carouselRef.current?.goToNext()}
              disabled={devices.length <= 1}
                style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: devices.length > 1 
                  ? 'linear-gradient(145deg, #4a7d5f, #1a3d24)'
                  : 'linear-gradient(145deg, #3a3a3a, #1a1a1a)',
                border: '3px solid',
                borderTopColor: devices.length > 1 ? '#5a8d6f' : '#4a4a4a',
                borderLeftColor: devices.length > 1 ? '#5a8d6f' : '#4a4a4a',
                borderRightColor: devices.length > 1 ? '#2a4d34' : '#2a2a2a',
                borderBottomColor: devices.length > 1 ? '#2a4d34' : '#2a2a2a',
                color: devices.length > 1 ? '#c8ffc8' : '#666',
                fontSize: 32,
                  fontWeight: 'bold',
                cursor: devices.length > 1 ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 8px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.2)',
                transition: 'all 0.15s',
                opacity: devices.length > 1 ? 1 : 0.4,
              }}
              aria-label="Next MineBoy"
            >
              ›
              </button>

            {/* Bottom: M/I/L buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
      
      {/* Global Modals */}
      <NavigationModal
        isOpen={showNavigationModal}
        page={navigationPage}
        onClose={closeNavigationModal}
      />
      
      <CartridgeSelectionModal
        isOpen={showAlchemyCartridges}
        onClose={() => setShowAlchemyCartridges(false)}
        onSelectCartridge={(cart) => handleAlchemyCartridgeSelect(cart, 0)}
        lockedCartridge={lockedCartridge}
        vaultAddress={vaultAddress || undefined}
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
