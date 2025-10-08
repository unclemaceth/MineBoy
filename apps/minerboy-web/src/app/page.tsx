"use client";
import { useState, useEffect, useCallback } from "react";
import dynamic from 'next/dynamic';
import Stage from "@/components/Stage";
import HUD from "@/components/HUD";
import ActionButton from "@/components/ui/ActionButton";
import DpadButton from "@/components/ui/DpadButton";
import FanSandwich from "@/components/ui/FanSandwich";
import SideButton from "@/components/ui/SideButton";
import PaidMessageModal from "@/components/PaidMessageModal";
import MineStrategyModal from "@/components/MineStrategyModal";
import EnhancedShell from "@/components/art/EnhancedShell";
import ClaimOverlay from "@/components/ClaimOverlay";
import NPCSimple from "@/components/art/NPCSimple";
import Visualizer3x3 from "@/components/Visualizer3x3";
import { useWalletModal } from '@/state/walletModal';
import { useWriteContract, useReadContract } from 'wagmi';
import { useActiveAccount } from '@/hooks/useActiveAccount';
import { useActiveDisconnect } from '@/hooks/useActiveDisconnect';
import { useActiveWalletClient } from '@/hooks/useActiveWalletClient';
import { useSession, getOrCreateMinerId } from "@/state/useSession";
import { useMinerStore } from "@/state/miner";
import { useMinerWorker } from "@/hooks/useMinerWorker";
import { useTypewriter } from "@/hooks/useTypewriter";
import { useJobTtl } from "@/hooks/useJobTtl";
import { useNPCBalance } from "@/hooks/useNPCBalance";
import { api } from "@/lib/api";
import { heartbeat } from "@/utils/HeartbeatController";
import CartridgeSelectionModal from '@/components/CartridgeSelectionModal';
import { getOwnedCartridges, type OwnedCartridge } from '@/lib/alchemy';
import { getMinerIdCached } from "@/utils/minerId";
import { getJobId, assertString } from "@/utils/job";
import { getOrCreateSessionId } from '@/lib/miningSession';
import { apiStart, apiHeartbeat } from '@/lib/miningApi';
import { normalizeJob } from '@/lib/normalizeJob';
import { to0x, hexFrom } from "@/lib/hex";
import { playButtonSound, playConfirmSound, playFailSound, startMiningSound, stopMiningSound, soundManager } from '@/lib/sounds';
import SoundSettings from '@/components/SoundSettings';
import NavigationModal from '@/components/NavigationModal';
import StatisticsSection from '@/components/StatisticsSection';
import type { CartridgeConfig } from "@/lib/api";
import type { MiningJob as Job } from "@/types/mining";
import RouterV3ABI from '@/abi/RouterV3.json';

const W = 390; // iPhone 13 CSS pixels
const H = 924; // iPhone 13 CSS pixels + 80px for HUD
const HUD_HEIGHT = 80; // HUD height
const CONTENT_HEIGHT = 844; // Original content area height
const px = (p: number, total: number) => Math.round(total * p / 100);

// Terminal typewriter component for individual messages
function TerminalTypewriter({ lines }: { lines: string[] }) {
  const { displayLines } = useTypewriter(lines, 15, 50); // Faster typing for terminal
  
  return (
    <div>
      {displayLines.map((line, index) => (
        <div key={index} style={{ 
          marginBottom: 2,
          opacity: index < 2 ? 0.6 : 1, // Fade older lines
        }}>
          {line}
        </div>
      ))}
    </div>
  );
}

type FoundResult = {
  hash: string;
  preimage: string;
  attempts: number;
  hr: number;
};

function Home() {
  const [connectPressed, setConnectPressed] = useState(false);
  const [cartridges, setCartridges] = useState<CartridgeConfig[]>([]);
  const [showCartridgeSelect, setShowCartridgeSelect] = useState(false);
  const [showJobExpired, setShowJobExpired] = useState(false);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [pendingClaimId, setPendingClaimId] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [mobileZoom, setMobileZoom] = useState(false);
  const [lockInfo, setLockInfo] = useState<any>(null);
  const [showAlchemyCartridges, setShowAlchemyCartridges] = useState(false);
  const [showNavigationModal, setShowNavigationModal] = useState(false);
  const [navigationPage, setNavigationPage] = useState<'leaderboard' | 'mint' | 'instructions' | 'welcome' | null>(null);
  const [showEjectConfirm, setShowEjectConfirm] = useState(false);
  const [ejectButtonPressed, setEjectButtonPressed] = useState(false);
  const [cooldownTimer, setCooldownTimer] = useState<number | null>(null);
  const [showPaidMessageModal, setShowPaidMessageModal] = useState(false);
  const [showMineStrategyModal, setShowMineStrategyModal] = useState(false);
  const [scrollingMessages, setScrollingMessages] = useState<Array<string | { text: string; color?: string; prefix?: string; type?: string }>>(["MineBoy it Mines stuff!"]);
  const [lockedCartridge, setLockedCartridge] = useState<{ contract: string; tokenId: string; ttl: number; type: 'conflict' | 'timeout' } | null>(null);

  // Navigation helpers
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

  // Show welcome modal on first load (unless user has hidden it)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hideWelcome = localStorage.getItem('mineboy_hideWelcome');
      if (!hideWelcome) {
        setTimeout(() => {
          setNavigationPage('welcome');
          setShowNavigationModal(true);
        }, 1000); // Delay 1 second after page load
      }
    }
  }, []);

  // Single-tab enforcement
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
        alert('MineBoy already open in another tab. Please close the other tab first.');
        window.close();
      }
    };
    hasLeader = true;
    
    return () => {
      bc.close();
    };
  }, []);
  const [mineBlink, setMineBlink] = useState(false);
  const [status, setStatus] = useState<'idle'|'mining'|'found'|'claiming'|'claimed'|'error'>('idle');
  const [foundResult, setFoundResult] = useState<FoundResult | null>(null);
  
  // Wagmi hooks
  const { address, isConnected, provider } = useActiveAccount();
  const { disconnectWallet } = useActiveDisconnect();
  const { open: openWalletModal } = useWalletModal();
  const { writeContract, writeContractAsync, data: hash } = useWriteContract();
  const walletClient = useActiveWalletClient();
  
  // Fetch NPC balance for multiplier display
  const { npcBalance } = useNPCBalance(address);
  
  // Read MNESTR token balance
  const { data: mnestrBalanceRaw } = useReadContract({
    address: '0xAe0DfbB1a2b22080F947D1C0234c415FabEEc276' as `0x${string}`, // MNESTR token address
    abi: [
      {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
      },
    ] as const,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
  
  // Format MNESTR balance (18 decimals)
  const mnestrBalance = mnestrBalanceRaw 
    ? Number(mnestrBalanceRaw) / 1e18 
    : 0;
  
  // Session state
  const { 
    wallet,
    cartridge,
    sessionId,
    job,
    mining, 
    attempts, 
    hr, 
    lastFound,
    terminal,
    mode,
    setWallet,
    setMining,
    setTelemetry,
    setFound,
    pushLine,
    setMode,
    setJob,
    loadOpenSession,
    clear
  } = useSession();
  
  // Miner store for boot sequence
  const { bootLines, stopMining, setHashRate } = useMinerStore();
  
  // ANTI-BOT: State for progress tracking
  const [miningProgress, setMiningProgress] = useState(0);
  const [miningEta, setMiningEta] = useState(0);
  
  // Miner worker
  const miner = useMinerWorker({
    onTick: (data) => {
      // ANTI-BOT: Updated to handle new data structure
      setTelemetry(data.attempts, data.hr);
      if (data.hash) {
        setCurrentDisplayHash(data.hash);
      }
      if (data.nibs && data.nibs.length === 9) {
        setVisualizerNibs(data.nibs);
      }
      // ANTI-BOT: Update progress and ETA
      if (data.progress !== undefined) {
        setMiningProgress(data.progress);
      }
      if (data.estimatedSecondsLeft !== undefined) {
        setMiningEta(data.estimatedSecondsLeft);
      }
    },
    onFound: ({ hash, preimage, attempts, hr }) => {
      // Note: Worker already validated TTL before posting FOUND
      // If we got here, the hash was found while job was valid
      
      setMining(false);
      setStatus('found');
      stopMiningSound();
      // Freeze the exact FOUND payload - never recompute
      const frozenResult = { hash, preimage, attempts, hr };
      setFoundResult(frozenResult);
      setFound({ hash: hash as `0x${string}`, preimage, attempts, hr });
      playConfirmSound();
      pushLine(`Found hash: ${hash.slice(0, 10)}...`);
      pushLine(`Press B to submit solution`);
      // Switch to grid view to show overlay
      setMode('visual');
      console.log('[FOUND_FROZEN]', frozenResult);
    },
    onError: (message) => {
      pushLine(`Error: ${message}`);
      setMining(false);
      setStatus('error');
      stopMiningSound();
    },
    onStopped: async (reason) => {
      console.log('[STOPPED_HANDLER]', reason);
      
      if (reason === 'window_exhausted') {
        // Counter window exhausted WITHOUT finding a hash - TIMEOUT PENALTY
        console.log('[WINDOW_EXHAUSTED] Counter window exhausted - timeout penalty');
        stopMining();
        setMining(false);
        setStatus('idle');
        stopMiningSound();
        playFailSound();
        setFoundResult(null);
        setFound(undefined);
        setCurrentDisplayHash('0x000000000000000000000000000000000000000000000000000000000000000000');
        setHashRate(0);
        
        // Lock this specific cartridge with timeout styling (60s cooldown)
        if (cartridge) {
          setLockedCartridge({
            contract: cartridge.info.contract,
            tokenId: cartridge.tokenId,
            ttl: 60,
            type: 'timeout'
          });
        }
        
        // Auto-unload cartridge and return to terminal mode
        clear();
        setMode('terminal');
        setShowCartridgeSelect(true);
        
        // Show gamified timeout messages
        pushLine('⏰ MINING TIMEOUT!');
        pushLine('Failed to find hash in time window');
        pushLine('Cartridge locked for 60 seconds');
        pushLine(' ');
        pushLine('Wait for cooldown to finish');
        
        // Reset the dead session state
        miner.resetSession();
      } else if (reason === 'manual_stop') {
        // User manually stopped mining
        console.log('[MANUAL_STOP] User stopped mining');
        stopMining();
        setMining(false);
        setStatus('idle');
        stopMiningSound();
      }
    },
  });
  
  // Typewriter for boot sequence
  const { displayLines: bootDisplayLines } = useTypewriter(
    booting ? bootLines : [],
    18,
    180,
    () => setBooting(false)
  );
  
  // Auto-start boot sequence on page load
  useEffect(() => {
    if (booting) {
      const timer = setTimeout(() => setBooting(false), 8000); // Longer duration to see all lines
      return () => clearTimeout(timer);
    }
  }, [booting]);

  // Cleanup session on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionId) {
        api.close(sessionId).catch(console.error);
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessionId]);

  // Fetch lock info when debug modal opens
  useEffect(() => {
    if (showDebugModal && cartridge) {
      fetchLockInfo();
    }
  }, [showDebugModal, cartridge]);
  
  // Update wallet when account changes
  useEffect(() => {
    console.log('Main page wallet state:', { isConnected, address });
    if (isConnected && address) {
      setWallet(address);
      pushLine('Connected to ApeChain Network');
      pushLine(`Wallet Address: ${address.slice(0, 8)}...${address.slice(-8)}`);
      pushLine('Waiting for Cartridge Load...');
    } else {
      setWallet(undefined);
      clear();
    }
  }, [isConnected, address, setWallet, clear, pushLine]);
  
  // Load cartridges on mount
  useEffect(() => {
    api.cartridges()
      .then(setCartridges)
      .catch(err => pushLine(`Failed to load cartridges: ${err.message}`));
  }, [pushLine]);

  // Load scrolling messages on mount and refresh every 5 minutes
  const fetchMessages = useCallback(async () => {
    try {
      const { messages } = await api.getMessages();
      if (messages && messages.length > 0) {
        setScrollingMessages(messages);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5 * 60 * 1000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, [fetchMessages]);
  
  // Mine blink effect
  useEffect(() => {
    if (!mining) { 
      setMineBlink(false); 
      return; 
    }
    const id = setInterval(() => setMineBlink(b => !b), 400);
    return () => clearInterval(id);
  }, [mining]);
  
  // REMOVED: Old TTL timer system - now using counter window exhaustion only
  // The worker will post STOPPED: window_exhausted when the counter window is done
  // TTL timeout handling is now in the onStopped callback below

  // Cooldown timer effect
  useEffect(() => {
    if (cooldownTimer === null || cooldownTimer <= 0) return;
    
    const interval = setInterval(() => {
      setCooldownTimer(prev => {
        if (prev === null || prev <= 1) {
          return null;
        }
        
        const newTime = prev - 1;
        console.log(`[COOLDOWN] ${newTime}s remaining`);
        
        return newTime;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [cooldownTimer]);

  // Locked cartridge timer effect
  useEffect(() => {
    if (!lockedCartridge || lockedCartridge.ttl <= 0) return;
    
    const interval = setInterval(() => {
      setLockedCartridge(prev => {
        if (!prev || prev.ttl <= 1) {
          console.log('[LOCKED_CART] Lock expired');
          return null;
        }
        
        const newTtl = prev.ttl - 1;
        console.log(`[LOCKED_CART] ${prev.tokenId} locked for ${newTtl}s`);
        
        return { ...prev, ttl: newTtl };
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [lockedCartridge]);

  // Heartbeat to refresh lock for entire session
  useEffect(() => {
    if (!sessionId) return;
    
    const heartbeatFn = async () => {
      try {
        if (!address || !cartridge) return;
        
        const sessionId = getOrCreateSessionId(parseInt(cartridge.tokenId));
        const chainId = cartridge.info.chainId;
        const contract = cartridge.info.contract as `0x${string}`;
        const minerId = getMinerIdCached();
        
        console.log('[HB_PAYLOAD]', { sessionId, minerId, chainId, contract, tokenId: cartridge.tokenId });
        
        await apiHeartbeat({
          wallet: address as `0x${string}`,
          chainId,
          contract,
          tokenId: parseInt(cartridge.tokenId), // Convert to number for type compatibility
          sessionId,
          minerId
        });
        
        // Debug lock info after heartbeat
        try {
          const lockInfo = await api.debugLock(sessionId);
          console.log('[LOCK_DEBUG]', lockInfo);
        } catch (e) {
          console.warn('Lock debug failed:', e);
        }
      } catch (error: any) {
        console.warn('Heartbeat failed:', error);
        
        // Parse structured error response
        let errorCode = 'unknown';
        let errorMessage = 'Heartbeat failed';
        
        if (error?.code) {
          errorCode = error.code;
          errorMessage = error.message || errorMessage;
        } else if (error?.status) {
          errorCode = `http_${error.status}`;
          errorMessage = error.info || errorMessage;
        }
        
        console.warn('Heartbeat error details:', { code: errorCode, message: errorMessage, original: error });
        
        // If session not found (404) or lock lost (409), clear session and stop mining
        if (errorCode === 'session_not_found' || errorCode === 'ownership_conflict' || error.status === 404 || error.status === 409) {
          console.log('Session expired or lock lost - clearing state and stopping mining');
          pushLine('Heartbeat Failed');
          pushLine('Initiating SYNC Resuscitation');
          pushLine('Checking for nodes...');
          pushLine('Connecting...');
          
          // Stop all mining systems immediately
          miner.stopForTtl(); // Stop the actual mining worker with TTL-specific handling
          stopMining(); // Stop the store's mining state
          setMining(false);
          stopMiningSound(); // Stop the mining sound
          playFailSound(); // Play fail sound for session expiry
          setCurrentDisplayHash('0x000000000000000000000000000000000000000000000000000000000000000000'); // Clear hash display
          setHashRate(0); // Clear hash rate display
          
          // Start cooldown timer for heartbeat failure
          setCooldownTimer(60);
          
          // Clear session state
          clear();
          setStatus('idle');
        }
      }
    };
    
    // Start heartbeat controller
    heartbeat.start(heartbeatFn, 2000);
    
    return () => {
      heartbeat.stop();
    };
  }, [sessionId]);

  // Watch for transaction hash and report to backend with retry
  useEffect(() => {
    console.log('[TX_HASH_DEBUG]', { pendingClaimId, hash, hasBoth: !!(pendingClaimId && hash) });
    
    if (!pendingClaimId || !hash) return;

    let cancelled = false;

    const submit = async (attempt = 0) => {
      try {
        console.log('[TX_HASH_SUBMIT]', { claimId: pendingClaimId, txHash: hash, attempt });
        await api.claimTx({ claimId: pendingClaimId, txHash: hash });
        pushLine('Transaction tracked by backend');
        setPendingClaimId(null); // prevent repeats
      } catch (e) {
        if (cancelled) return;
        const backoff = Math.min(30_000, 1000 * Math.pow(2, attempt)); // up to 30s
        console.warn(`Failed to submit tx hash (attempt ${attempt + 1}), retrying in ${backoff}ms:`, e);
        setTimeout(() => submit(attempt + 1), backoff);
      }
    };

    submit();

    return () => { cancelled = true; };
  }, [hash, pendingClaimId, pushLine]);

  // Cleanup on page unload and visibility changes
  useEffect(() => {
    const handleBeforeUnload = () => {
      heartbeat.stop();
    };

    const handleVisibilityChange = () => {
      // Heartbeats are now session-based, not mining-based
      // No need to stop/start on visibility change
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [mining, sessionId]);
  
  
  // Button handlers
  const handleConnect = async () => {
    setConnectPressed(true);
    setTimeout(() => setConnectPressed(false), 150);

    if (!isConnected) {
      openWalletModal();
    } else {
      // Close any active session before disconnecting
      if (sessionId) {
        api.close(sessionId).catch(console.error);
      }
      disconnectWallet();
      clear();
      pushLine('Disconnected');
    }
  };
  
  const handleInsertCartridge = () => {
    if (isConnected && !sessionId) {
      setShowAlchemyCartridges(true); // Open Alchemy modal directly
    } else if (!isConnected) {
      pushLine('Connect wallet first!');
    } else {
      pushLine('Cartridge already inserted');
    }
  };

  // Function to fetch lock information
  const fetchLockInfo = async () => {
    if (!cartridge || !address) return;
    
    try {
      // This would be a new API endpoint to get lock status
      // For now, we'll simulate the data structure
      const sessionId = getOrCreateSessionId(parseInt(cartridge.tokenId));
      const mockLockInfo = {
        ownershipLock: {
          active: true,
          ttl: 3600, // 1 hour
          owner: address,
          expiresAt: Date.now() + 3600000
        },
        sessionLock: {
          active: true,
          ttl: 60, // 60 seconds
          sessionId: sessionId,
          expiresAt: Date.now() + 60000
        },
        walletSessions: {
          active: 1,
          limit: 10
        }
      };
      setLockInfo(mockLockInfo);
    } catch (error) {
      console.warn('Failed to fetch lock info:', error);
    }
  };
  
  const handleAlchemyCartridgeSelect = async (ownedCartridge: OwnedCartridge) => {
    if (!address) return;
    
    setShowAlchemyCartridges(false);
    
    console.log('[ALCHEMY_SELECT] Received pickaxe:', ownedCartridge);
    console.log('[ALCHEMY_SELECT] tokenId type:', typeof ownedCartridge.tokenId, 'value:', ownedCartridge.tokenId);
    console.log('[ALCHEMY_SELECT] parseInt result:', parseInt(ownedCartridge.tokenId));
    console.log('[ALCHEMY_SELECT] metadata:', ownedCartridge.metadata);
    
    // Create a CartridgeConfig from the owned pickaxe
    const pickaxeName = ownedCartridge.metadata?.type 
      ? ownedCartridge.metadata.type.replace('The ', '').replace('The Morgul ', '')
      : 'Pickaxe';
    
    const cartridgeInfo: CartridgeConfig = {
      name: `${pickaxeName} #${ownedCartridge.tokenId}`,
      contract: ownedCartridge.contractAddress,
      chainId: ownedCartridge.chainId
    };
    
    // Use the same flow as the keypad - call handleCartridgeSelect with metadata
    await handleCartridgeSelect(cartridgeInfo, ownedCartridge.tokenId, ownedCartridge.metadata);
  };

  const handleCartridgeSelect = async (cartridgeInfo: CartridgeConfig, tokenId: string, metadata?: any) => {
    if (!address) return;
    
    setShowCartridgeSelect(false);
    pushLine(`Opening session with ${cartridgeInfo.name}...`);
    
    try {
      // Clear any existing session state first
      clear();
      
      // Use the new two-tier locking system
      const sessionId = getOrCreateSessionId(parseInt(tokenId));
      const chainId = cartridgeInfo.chainId;
      const contract = cartridgeInfo.contract as `0x${string}`;
      const minerId = getMinerIdCached();
      
      console.log('[SESSION_OPEN] Using new two-tier system:', {
        sessionId,
        wallet: address,
        chainId,
        contract,
        tokenId: parseInt(tokenId),
        minerId
      });
      
      const res = await apiStart({
        wallet: address as `0x${string}`,
        chainId,
        contract,
        tokenId: parseInt(tokenId),
        sessionId,
        minerId
      });
      
      console.log('[SESSION_OPEN] Success:', res);
      
      // Create a compatible session object for the existing loadOpenSession function
      const compatibleSession = {
        sessionId: res.sessionId,
        // ANTI-BOT FIX: Pass the entire job object to normalizeJob instead of cherry-picking fields
        job: res.job ? normalizeJob(res.job as any) : undefined
      };
      
      loadOpenSession(compatibleSession, address, { info: cartridgeInfo, tokenId, metadata });
      pushLine(`Session opened! Job ID: ${res.job?.id || 'unknown'}`);
      
    } catch (error: any) {
      console.error('[SESSION_OPEN] Error:', error);
      
      // Parse error info from nested structure
      let errorInfo = error.info || error;
      
      // If errorInfo is an Error object, try to extract JSON from the message
      if (errorInfo instanceof Error || errorInfo?.message) {
        const errorMessage = errorInfo.message || String(errorInfo);
        const jsonMatch = errorMessage.match(/\{.*\}/);
        if (jsonMatch) {
          try {
            errorInfo = JSON.parse(jsonMatch[0]);
          } catch (e) {
            console.warn('[SESSION_OPEN] Failed to parse JSON from error message:', e);
          }
        }
      } else if (typeof errorInfo === 'string') {
        try {
          errorInfo = JSON.parse(errorInfo);
        } catch (e) {
          // If parsing fails, use the original error
          errorInfo = error;
        }
      }
      
      console.log('[SESSION_OPEN] Parsed error info:', errorInfo);
      
      // Handle new two-tier locking error codes
      if (errorInfo.code === 'cartridge_in_use') {
        const minutes = errorInfo.remainingMinutes || 'unknown';
        pushLine(`🔒 Cartridge locked for ~${minutes} minutes. Try later.`);
        setShowCartridgeSelect(true); // Re-show selection
        return;
      }
      
      if (errorInfo.code === 'session_conflict') {
        const ttlSec = errorInfo.details?.ttlSec || 60;
        pushLine(`🔒 SESSION CONFLICT DETECTED`);
        pushLine(`This cartridge is already mining`);
        pushLine(`on another browser/window/device.`);
        pushLine(` `);
        pushLine(`Check your other devices for`);
        pushLine(`active sessions using this cart.`);
        pushLine(` `);
        pushLine(`Cart locked for ${ttlSec}s`);
        
        // Lock this specific cartridge instead of all selections
        setLockedCartridge({
          contract: cartridgeInfo.contract,
          tokenId: tokenId,
          ttl: ttlSec,
          type: 'conflict'
        });
        
        setShowCartridgeSelect(true); // Re-show selection
        return;
      }
      
      if (errorInfo.code === 'session_still_active') {
        pushLine('⚠️ Mining already active in another tab for this cartridge.');
        setShowCartridgeSelect(true); // Re-show selection
        return;
      }
      
      if (errorInfo.code === 'active_session_elsewhere') {
        pushLine('⚠️ Another session is active on this cartridge.');
        setShowCartridgeSelect(true); // Re-show selection
        return;
      }
      
      if (errorInfo.code === 'wallet_session_limit_exceeded') {
        const limit = errorInfo.limit || 10;
        const active = errorInfo.activeCount || 0;
        pushLine(`🚫 Max ${limit} concurrent sessions reached (${active}/${limit}). Close a session to start another.`);
        setShowCartridgeSelect(true); // Re-show selection
        return;
      }
      
      // Fallback for old error format
      if (String(error.message).includes('HTTP 409')) {
        pushLine('🔒 Cartridge is in use. Press Side Button to reset or wait a few seconds.');
        setShowCartridgeSelect(true); // Re-show selection
        return;
      }
      
      // Gamified error messages instead of raw JSON
      pushLine('⚠️ CARTRIDGE ERROR');
      pushLine('Connection failed - retrying...');
      pushLine('Check your network connection');
      setShowCartridgeSelect(true); // Re-show selection on any error
    }
  };
  
  const handleA = async () => {
    playButtonSound();
    
    console.log('A button pressed - Debug info:', {
      isConnected,
      sessionId,
      job,
      mining,
      cartridge,
      status
    });
    
    // Ignore if already mining or claiming
    if (status === 'mining' || status === 'claiming') {
      console.log('Ignoring A press - already busy');
      return;
    }
    
    if (!isConnected) {
      pushLine('Connect wallet first!');
      return;
    }
    
    if (!sessionId) {
      pushLine('Insert cartridge first!');
      return;
    }
    
    if (!mining) {
      // Determine which job to use
      let jobToUse = job;
      
      // If no job exists, or the existing job has expired, fetch a fresh one
      if (!job || !job.id || (job.expiresAt && Date.now() > job.expiresAt)) {
        try {
          pushLine('Requesting fresh mining job...');
          const freshJob = await api.getNextJob(sessionId);
          
          if (!freshJob) {
            pushLine('No job available (cadence gate)');
            pushLine('Wait a moment and try again');
            return;
          }
          
          // Update job state with fresh job
          setJob(freshJob);
          jobToUse = freshJob;
          console.log('[FRESH_JOB_FOR_MINING]', {
            jobId: freshJob.id,
            expiresAt: freshJob.expiresAt,
            counterStart: freshJob.counterStart,
            counterEnd: freshJob.counterEnd
          });
        } catch (error: any) {
          console.error('[FRESH_JOB_ERROR]', error);
          
          // Handle rate limiting with gamified messages
          if (error.type === 'rate_limit') {
            stopMining();
            setMining(false);
            setStatus('idle');
            playFailSound();
            
            // Auto-switch to terminal
            setMode('terminal');
            clear();
            
            // Gamified rate limit messages
            pushLine('⚠️  RATE LIMIT EXCEEDED!');
            pushLine(' ');
            pushLine('Too many job requests detected');
            const waitSec = Math.ceil(error.waitMs / 1000);
            pushLine(`Cooldown: ${waitSec} seconds`);
            pushLine(' ');
            if (error.reason?.includes('wallet')) {
              pushLine('🚫 Wallet limit: 10 requests/minute');
            } else if (error.reason?.includes('IP')) {
              pushLine('🚫 Network limit: 50 requests/minute');
            }
            pushLine('Wait for cooldown to finish');
            pushLine(' ');
            pushLine('Mining is a marathon, not a sprint!');
            
            return;
          }
          
          // Generic error handling
          pushLine('Failed to get fresh job');
          pushLine('Re-insert cartridge if issue persists');
          return;
        }
      } else {
        // Use existing job from session open or previous claim
        console.log('[USING_EXISTING_JOB]', {
          jobId: job.id,
          expiresAt: job.expiresAt,
          counterStart: job.counterStart,
          counterEnd: job.counterEnd
        });
        pushLine('Starting mining...');
      }
      
      // Safety check - refuse to start if job is empty
      if (!jobToUse?.id || !jobToUse?.data || !jobToUse?.target) {
        console.warn('Job invalid, not starting miner');
        pushLine('Invalid job - re-insert cartridge');
        return;
      }
        
      // SECURITY: Validate we have wallet and cartridge info
      if (!wallet || !cartridge?.tokenId) {
        console.warn('Missing wallet or cartridge info, cannot start mining');
        pushLine('Session error - re-insert cartridge');
        return;
      }
      
      setFoundResult(null);
      setFound(undefined); // Clear lastFound from session
      setStatus('mining');
      setMining(true);
      setMode('visual'); // Auto-switch to visualizer
      
      // Reset dead session state before starting mining
      miner.resetSession();
      
      // SECURITY: Pass wallet and tokenId to bind work to this specific user+NFT
      miner.start(jobToUse, wallet, cartridge.tokenId);
      startMiningSound();
    } else {
      // Stop mining
      console.log('Stopping mining');
      miner.stop();
      setMining(false);
      setStatus('idle');
      stopMiningSound();
      pushLine('Mining stopped');
    }
  };
  
  // Claim function
  const handleClaim = async (hit: FoundResult) => {
    try {
      setStatus('claiming');
      pushLine('Submitting claim...');

      if (!sessionId || !job) {
        throw new Error('No active session or job');
      }

      // Note: We don't check TTL here because:
      // 1. The worker validates TTL during mining
      // 2. If hash was found before TTL expired, claim should be allowed
      // 3. Backend validates job validity on submission

      // Keep heartbeats running during claim to maintain lock

      // Send the frozen payload exactly as received from worker
      const minerId = getMinerIdCached();
      const jobId = getJobId(job);
      
      // Assert all required values are present
      assertString(sessionId, 'sessionId');
      assertString(jobId, 'jobId');
      assertString(address, 'address');
      
      // 1) Refresh lock right before claim
      console.log('[CLAIM] pre-heartbeat', { sessionId, wallet: address });
      if (cartridge) {
        const sessionId = getOrCreateSessionId(parseInt(cartridge.tokenId));
        const chainId = cartridge.info.chainId;
        const contract = cartridge.info.contract as `0x${string}`;
        const minerId = getMinerIdCached();
        
        await apiHeartbeat({
          wallet: address as `0x${string}`,
          chainId,
          contract,
          tokenId: parseInt(cartridge.tokenId),
          sessionId,
          minerId
        });
      }
      pushLine('Lock refreshed for claim...');
      
      // Debug lock info before claim
      try {
        const lockInfo = await api.debugLock(sessionId);
        console.log('[CLAIM_LOCK_DEBUG]', lockInfo);
      } catch (e) {
        console.warn('Claim lock debug failed:', e);
      }
      
      // 2) Tiny backoff to let the lock propagate
      await new Promise(r => setTimeout(r, 120));
      
      console.log('[CLAIM_PAYLOAD]', { sessionId, minerId, jobId });
      
      // Log identity for debugging
      console.log('[IDS]', {
        sessionId,
        minerId,
        jobId,
        address
      });
      
      // 3) Try claim with reattach + retry on 409
      const doClaim = () => api.claimV3({
        sessionId,
        jobId,
        preimage: hit.preimage,  // exact string from worker
        hash: to0x(hit.hash),    // exact hash from worker
        steps: hit.attempts,
        hr: hit.hr,
        minerId, // plain string, no cast
      });
      
      let claimResponse: any;
      try {
        claimResponse = await doClaim();
      } catch (e: any) {
        if (e.status === 409) {
          // 4) Reattach + one retry
          pushLine('Retrying claim after reattach...');
          if (cartridge) {
            const sessionId = getOrCreateSessionId(parseInt(cartridge.tokenId));
            const chainId = cartridge.info.chainId;
            const contract = cartridge.info.contract as `0x${string}`;
            
            await apiHeartbeat({
              wallet: address as `0x${string}`,
              chainId,
              contract,
              tokenId: parseInt(cartridge.tokenId),
              sessionId
            });
          }
          await new Promise(r => setTimeout(r, 150));
          claimResponse = await doClaim();
        } else {
          throw e;
        }
      }

      console.log('[CLAIM_OK]', claimResponse);
      console.log('[REWARD_TOKEN_DEBUG]', {
        rewardToken: claimResponse.claim?.rewardToken,
        expected: '0x5f942b20b8aa905b8f6a46ae226e7f6bf2f44023',
        isCorrect: claimResponse.claim?.rewardToken?.toLowerCase() === '0x5f942b20b8aa905b8f6a46ae226e7f6bf2f44023'
      });
      console.log('[CLAIM_DATA]', { 
        hasClaim: !!claimResponse.claim, 
        hasSignature: !!claimResponse.signature,
        claimId: claimResponse.claimId 
      });
      pushLine('Claim verified by backend');
      
      // Store claimId for later use
      if (claimResponse.claimId) {
        setPendingClaimId(claimResponse.claimId);
      }
      
      // Update job if next job is provided
      if (claimResponse.nextJob) {
        setJob(claimResponse.nextJob);
        pushLine(`New job issued (height ${claimResponse.nextJob.height || 0})`);
        console.log('[NEXT_JOB]', claimResponse.nextJob);
      }
      
      // Check if we have claim data for on-chain transaction
      if (claimResponse.claimId && claimResponse.claim && claimResponse.signature) {
        pushLine('Preparing on-chain transaction...');
        if (claimResponse.txHash) {
          pushLine(`Transaction: ${claimResponse.txHash.slice(0, 8)}...${claimResponse.txHash.slice(-6)}`);
        }
        
        try {
          // Submit claim to smart contract
          pushLine('Opening wallet for transaction...');
          
          // Use the proper MiningClaimRouter contract
          const routerAddress = process.env.NEXT_PUBLIC_ROUTER_ADDRESS;
          
          // Use the claim data from backend (properly formatted)
          const claimData = {
            cartridge: to0x(claimResponse.claim.cartridge),
            tokenId: BigInt(claimResponse.claim.tokenId),
            wallet: to0x(claimResponse.claim.wallet),
            nonce: to0x(claimResponse.claim.nonce),
            tier: BigInt(claimResponse.claim.tier),
            tries: BigInt(claimResponse.claim.tries),
            elapsedMs: BigInt(claimResponse.claim.elapsedMs),
            hash: to0x(claimResponse.claim.hash),
            expiry: BigInt(claimResponse.claim.expiry)
          };

          const contractConfig = {
            address: routerAddress as `0x${string}`,
            abi: RouterV3ABI,
            functionName: 'claimV3',
            args: [claimData, to0x(claimResponse.signature)],
            value: BigInt('10000000000000000'), // 0.01 APE - V3 total fee
          };


          // Debug wallet client state
          console.log('[WALLET_DEBUG]', {
            walletClient: !!walletClient,
            walletClientType: walletClient?.constructor?.name,
            hasWriteContract: !!writeContract,
            address,
            provider
          });

          // Use provider to determine which path to take
          let txHash: string | undefined;
          if (provider === 'glyph' && walletClient) {
            // For Glyph connections, use walletClient directly
            console.log('[TX] Using Glyph walletClient');
            txHash = await walletClient.writeContract(contractConfig);
            console.log('[TX] Transaction hash:', txHash);
          } else if (provider === 'wc' && walletClient) {
            // For Web3Modal connections, use viem wallet client with window.ethereum
            console.log('[TX] Using Web3Modal walletClient (via window.ethereum)');
            console.log('[TX] Config:', contractConfig);
            txHash = await walletClient.writeContract(contractConfig);
            console.log('[TX] Transaction hash:', txHash);
          } else {
            // Fallback
            console.log('[TX] No wallet client available, cannot send transaction');
            throw new Error('No wallet client available');
          }
          
          // Send transaction hash to backend immediately
          if (txHash && claimResponse.claimId) {
            try {
              console.log('[TX_HASH_SUBMIT_IMMEDIATE]', { claimId: claimResponse.claimId, txHash });
              await api.claimTx({ claimId: claimResponse.claimId, txHash });
              pushLine('Transaction tracked by backend');
            } catch (e) {
              console.error('[TX_HASH_SUBMIT_ERROR]', e);
              // Don't fail the claim if backend tracking fails
            }
          }
          
          pushLine('Transaction submitted - waiting for hash...');
          pushLine('Waiting for confirmation...');
          
          // Note: Transaction confirmation would be handled by wagmi hooks
          setStatus('claimed');
          pushLine('Claim successful!');
          
          // Display multiplier if present
          if (claimResponse.multiplier && claimResponse.multiplier.multiplier > 1.0) {
            pushLine(' ');
            pushLine(`🚀 MULTIPLIER BONUS: ${claimResponse.multiplier.multiplier}x`);
            claimResponse.multiplier.details.forEach((detail: string) => {
              pushLine(`   ${detail}`);
            });
          }
          
          
        } catch (txError: unknown) {
          console.error('[TX_ERROR]', txError);
          
          // Parse transaction errors for user-friendly messages
          const errorMessage = txError instanceof Error ? txError.message : String(txError);
          
          // User rejected transaction
          if (errorMessage.includes('User rejected') || 
              errorMessage.includes('user rejected') ||
              errorMessage.includes('User denied') ||
              errorMessage.includes('rejected the request')) {
            pushLine('Transaction cancelled');
            pushLine('You rejected the claim');
            pushLine(' ');
            pushLine('Press A to try again');
            setStatus('idle');
            return;
          }
          
          // Insufficient funds
          if (errorMessage.includes('insufficient funds') || errorMessage.includes('InsufficientFunds')) {
            pushLine('Transaction failed');
            pushLine('Insufficient APE for gas');
            pushLine(' ');
            pushLine('Get more APE and try again');
            setStatus('error');
            return;
          }
          
          // Contract revert with reason
          if (errorMessage.includes('execution reverted:')) {
            const revertReason = errorMessage.split('execution reverted:')[1]?.split('\n')[0]?.trim();
            pushLine('Transaction reverted');
            if (revertReason && revertReason.length < 50) {
              pushLine(revertReason);
            }
            pushLine(' ');
            pushLine('Contact support if issue persists');
            setStatus('error');
            return;
          }
          
          // Generic transaction error
          pushLine('Transaction failed');
          pushLine('Check wallet and try again');
          setStatus('error');
        }
      } else {
        pushLine('Off-chain verification complete');
        setStatus('claimed');
      }
      
      pushLine('Press A to mine again');
      
      // Clear found result immediately after successful claim
      setFound(undefined); // Clear lastFound from session store
      
      // Clear found result after successful claim
      setTimeout(() => {
        setFoundResult(null);
        setStatus('idle');
      }, 3000);
      
    } catch (err: any) {
      console.error('[CLAIM] failed', err.status, err.info);
      
      // SECURITY: Check for physics validation failures (too fast/too slow)
      const errorMsg = err.info?.error || err.message || '';
      const isTooFast = errorMsg.toLowerCase().includes('too fast');
      const isTooSlow = errorMsg.toLowerCase().includes('too slow') || errorMsg.toLowerCase().includes('cherry');
      
      if (isTooFast || isTooSlow) {
        // Physics violation detected - auto-switch to terminal
        setMode('terminal');
        setFoundResult(null);
        setFound(undefined);
        setCurrentDisplayHash('0x000000000000000000000000000000000000000000000000000000000000000000');
        setStatus('idle');
        
        clear();
        if (isTooFast) {
          pushLine('🚨 SECURITY ALERT: CLAIM TOO FAST');
          pushLine(' ');
          pushLine('Work completed impossibly quickly');
          pushLine('Possible GPU mining or tampering');
          pushLine(' ');
          pushLine('🛡️  Anti-bot protection active');
          pushLine('Fair play required for all miners');
        } else {
          pushLine('🚨 SECURITY ALERT: SUSPICIOUS TIMING');
          pushLine(' ');
          pushLine('Work took too long to complete');
          pushLine('Possible hash cherry-picking detected');
          pushLine(' ');
          pushLine('🛡️  Anti-bot protection active');
          pushLine('Submit work promptly after finding');
        }
        pushLine(' ');
        pushLine('Press A to try again');
        
        playFailSound();
        
        return; // Exit early
      }
      
      // Check if this is an AFK penalty (job expired before claim)
      // Backend returns "Invalid or expired job" when the job's expiresAt has passed
      const isExpired = err.info?.error === 'Invalid or expired job' || err.message === 'Job expired - cannot claim';
      if (isExpired) {
        // AFK Penalty - user found hash but didn't claim in time
        setMode('terminal'); // Force switch to terminal view so they see the message
        setFoundResult(null); // Clear the found hash
        setFound(undefined); // Clear lastFound from session
        setCurrentDisplayHash('0x000000000000000000000000000000000000000000000000000000000000000000'); // Reset hash display
        setStatus('idle');
        
        // Show gamified AFK penalty messages
        pushLine('⏰ AFK PENALTY!');
        pushLine('You missed your hash window!');
        pushLine('The job expired before you claimed.');
        pushLine(' ');
        pushLine('Press A to start mining again');
        
        playFailSound(); // Play fail sound for penalty
        
        return; // Exit early
      }
      
      // Handle session expiration specifically
      if (err.status === 404 || err.status === 409) {
        if (err.info?.code === 'session_conflict') {
          const ttlSec = err.info?.details?.ttlSec || 60;
          pushLine(`🔒 CARTRIDGE LOCKED`);
          pushLine(`Session conflict - wait ${ttlSec}s`);
          pushLine(`Another session is active for this cartridge`);
        } else {
          pushLine(`Session conflict: ${err.info?.error || 'Unknown error'}`);
        }
        
        // Clear session state
        clear();
        setStatus('idle');
        
        // Stop any running worker
        miner.stop();
      } else {
        pushLine(`Claim failed: ${err.status} ${err.info?.error || err.message || 'Unknown error'}`);
        setStatus('error');
      }
        } finally {
          // Heartbeats continue running throughout the session
        }
  };

  const handleGetNewJob = async () => {
    if (!sessionId) return;
    
    try {
      setShowJobExpired(false);
      pushLine('Requesting new job...');
      const newJob = await api.getNextJob(sessionId);
      if (!newJob) {
        pushLine('No job available (cadence gate) - wait a moment');
        return;
      }
      setJob(newJob);
      pushLine('New job received - Press A to mine');
    } catch {
      pushLine('Failed to get new job - re-insert cartridge');
    }
  };

  const handleReinsertCartridge = () => {
    setShowJobExpired(false);
    clear(); // Clear all session data
    setShowCartridgeSelect(true);
    pushLine('Please re-insert cartridge');
  };


  const handleB = () => {
    playButtonSound();
    
    if (status === 'found' && foundResult) {
      handleClaim(foundResult);
    } else if (lastFound) {
      // Reopen claim modal for found hash
      setFoundResult(lastFound);
      setStatus('found');
      pushLine('Claim modal reopened - press Claim to submit or B to dismiss');
    } else {
      pushLine('B: No hash to claim');
    }
  };
  
  const handleDpad = (direction: string) => {
    playButtonSound();
    
    // Handle mode switching with left/right
    if (direction === 'left') {
      setMode('terminal');
      pushLine('Switched to terminal view');
    } else if (direction === 'right') {
      setMode('visual');
      pushLine('Switched to visualizer view');
    } else {
      pushLine(`D-Pad: ${direction}`);
    }
  };

  const handleEjectButton = () => {
    if (!cartridge || !sessionId) {
      // No cart loaded, button is not clickable
      return;
    }
    
    playButtonSound();
    setEjectButtonPressed(true);
    setTimeout(() => setEjectButtonPressed(false), 150);
    setShowEjectConfirm(true);
  };

  const confirmEjectCart = async () => {
    if (sessionId) {
      try {
        await api.close(sessionId);
      } catch (err) {
        console.error('Error closing session:', err);
      }
    }
    
    // Reload the page to fully reset state
    window.location.reload();
  };
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // CRITICAL: Don't intercept keys when user is typing in an input/textarea
      const target = e.target as HTMLElement;
      const isTyping = target && (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );
      
      // If user is typing, only handle Escape (to close modals)
      if (isTyping && e.key !== 'Escape') {
        return; // Let the input handle the keypress
      }
      
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          handleDpad('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleDpad('down');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleDpad('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleDpad('right');
          break;
        case 'z':
        case 'Z':
          e.preventDefault();
          handleA().catch(console.error);
          break;
        case 'x':
        case 'X':
          e.preventDefault();
          handleB();
          break;
        case 'Enter':
          e.preventDefault();
          handleConnect();
          break;
        case 'd':
        case 'D':
          e.preventDefault();
          setShowDebugModal(true);
          break;
        case 'Escape':
          e.preventDefault();
          if (mining) {
            miner.stop();
            setMining(false);
            pushLine('Mining stopped');
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mining, miner, setMining, pushLine]);
  // Format hash for display: 0x000000000000000000000000...000000 (first 24 + last 6)
  const formatHashForDisplay = (hash: string | null, suffix: string | null = null) => {
    if (!hash || hash === "idle") {
      return "0x000000000000000000000000...000000"; // idle state
    }
    
    // Remove 0x prefix if present
    const cleanHash = hash.startsWith("0x") ? hash.slice(2) : hash;
    
    // Show first 24 characters, then ..., then last 6 characters
    const prefix = cleanHash.slice(0, 24);
    const suffixToShow = suffix && suffix.length >= 6 ? suffix.slice(-6) : cleanHash.slice(-6);
    
    return `0x${prefix}...${suffixToShow}`;
  };
  
  // LCD display data from state
  const [currentDisplayHash, setCurrentDisplayHash] = useState('0x0000000000000000000000000000000000000000000000000000000000000000');
  const [visualizerNibs, setVisualizerNibs] = useState<number[]>([0,0,0,0,0,0,0,0,0]);
  
  // Update hash display when mining
  useEffect(() => {
    if (!mining || !job) {
      setCurrentDisplayHash(hexFrom(job?.nonce, 64));
      setVisualizerNibs([0,0,0,0,0,0,0,0,0]); // Reset visualizer
      return;
    }

    let counter = 0;
    
    const updateHash = () => {
      // Generate a realistic-looking hash based on job nonce + counter
      const nonce = hexFrom(job?.nonce, 64).slice(2); // Remove 0x
      const counterHex = counter.toString(16).padStart(8, '0');
      const combined = nonce + counterHex;
      
      // Simple hash simulation - just rotate and modify
      let hash = '0x';
      for (let i = 0; i < 64; i += 2) {
        const idx = (i + counter) % combined.length;
        const char1 = combined[idx] || '0';
        const char2 = combined[(idx + 1) % combined.length] || '0';
        hash += char1 + char2;
      }
      
      setCurrentDisplayHash(hash);
      counter++;
    };

    // Update hash every 200ms when mining
    const interval = setInterval(updateHash, 200);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [mining, job]);

  const hashLcdText = formatHashForDisplay(currentDisplayHash);
  const statusLcdText = cooldownTimer !== null ? `${cooldownTimer}s` :
                       !isConnected ? 'DISCONNECTED' : 
                       !sessionId ? 'DISCONNECTED' :
                       status === 'found' ? 'SUCCESS' :
                       status === 'claimed' ? 'READY' :
                       mining ? attempts.toLocaleString() : 'READY';
  const hashRateLcdText = `${hr.toLocaleString()} H/s`;
  
  // ANTI-BOT: Progress LCD text (replaces difficulty display)
  const [progressText, setProgressText] = useState('No job');
  const ttlSec = useJobTtl(job);
  
  useEffect(() => {
    if (!job) { 
      setProgressText('No job'); 
      return; 
    }
    
    if (!mining) {
      setProgressText('Ready to mine');
      return;
    }
    
    // ANTI-BOT: Show progress and ETA during mining
    if (miningProgress > 0 || miningEta > 0) {
      const progressStr = `${Math.floor(miningProgress)}%`;
      const etaStr = miningEta > 0 ? `${Math.floor(miningEta)}s` : '--';
      setProgressText(`Progress: ${progressStr} | ETA: ${etaStr}`);
    } else {
      setProgressText('Mining...');
    }
  }, [job, mining, miningProgress, miningEta]);

  // Helper function for short hash display
  const short = (h?: string, n = 10) =>
    h ? `${h.slice(0, n)}…${h.slice(-n)}` : '';

  // Button styles for overlay
  const btnGreen: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: 10,
    border: '2px solid #8a8a8a',
    background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
    fontWeight: 800,
    fontSize: 12,
    color: '#fff',
    cursor: 'pointer',
  };

  const btnGray: React.CSSProperties = {
    ...btnGreen,
    background: 'linear-gradient(145deg, #4a4a4a, #1a1a1a)',
  };

  return (
    <Stage width={390} height={924}> {/* Extended by 80px for HUD */}
      {/* HUD at the top */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        zIndex: 50,
      }}>
        <HUD
          pickaxeType={cartridge?.metadata?.type}
          pickaxeId={cartridge?.tokenId}
          multiplier={npcBalance >= 10 ? 1.5 : npcBalance >= 1 ? 1.2 : 1.0}
          multiplierSource={npcBalance >= 1 ? `NPC` : "BASE"}
          seasonPoints={0} // TODO: Get from leaderboard API
          width={390}
          messages={scrollingMessages}
          scrollSpeed={50}
          messageGap={150}
          loopPause={3000}
          onMessageBarClick={() => {
            playButtonSound();
            setShowPaidMessageModal(true);
          }}
          onMnestrClick={() => {
            playButtonSound();
            setShowMineStrategyModal(true);
          }}
        />
      </div>

      {/* Side Button - top left (eject cart) */}
      <div style={{
        position: 'absolute',
        top: (cartridge && sessionId) ? (ejectButtonPressed ? 246.25 : 210.25) : 246.25,
        left: 0,
        zIndex: 100,
        transition: 'top 150ms ease',
        cursor: (cartridge && sessionId) ? 'pointer' : 'default',
        opacity: (cartridge && sessionId) ? 1 : 0.5,
      }}
      onClick={handleEjectButton}
      >
        <SideButton />
      </div>

      {/* Navigation Links */}
      <div style={{
        position: 'absolute',
        top: 887.5, // Moved down by 80px
        right: 280,
        zIndex: 100,
        display: 'flex',
        gap: '8px'
      }}>
            <button 
              onClick={() => openNavigationPage('mint')}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
                color: '#c8ffc8',
                fontSize: '14px',
                fontWeight: 'bold',
                border: '2px solid #8a8a8a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                transition: 'all 0.1s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(145deg, #1a3d24, #4a7d5f)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(145deg, #4a7d5f, #1a3d24)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              M
            </button>
            <button 
              onClick={() => openNavigationPage('instructions')}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
                color: '#c8ffc8',
                fontSize: '14px',
                fontWeight: 'bold',
                border: '2px solid #8a8a8a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                transition: 'all 0.1s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(145deg, #1a3d24, #4a7d5f)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(145deg, #4a7d5f, #1a3d24)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              I
            </button>
            <button 
              onClick={() => openNavigationPage('leaderboard')}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
                color: '#c8ffc8',
                fontSize: '14px',
                fontWeight: 'bold',
                border: '2px solid #8a8a8a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                transition: 'all 0.1s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(145deg, #1a3d24, #4a7d5f)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(145deg, #4a7d5f, #1a3d24)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              L
            </button>
      </div>

      {/* Hash Found Overlay - only show in visual mode when found */}
      {status === 'found' && mode === 'visual' && foundResult && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(0,0,0,0.55)',
            zIndex: 20,
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              minWidth: 260,
              maxWidth: 340,
              padding: 16,
              borderRadius: 12,
              background: 'linear-gradient(180deg, #1a3d24, #0f2216)',
              border: '2px solid #4a7d5f',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              color: '#c8ffc8',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 1, marginBottom: 6 }}>
              HASH FOUND
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, opacity: 0.9, marginBottom: 12 }}>
              {short(foundResult.hash, 12)} • attempts {foundResult.attempts.toLocaleString()}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={() => { playButtonSound(); handleClaim(foundResult); }} style={btnGreen}>Claim</button>
              <button onClick={() => { playButtonSound(); setStatus('idle'); }} style={btnGray}>Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Shell Background */}
      <div style={{
        position: "absolute",
        top: HUD_HEIGHT,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 28,
        overflow: "hidden",
      }}>
        <EnhancedShell width={W} height={CONTENT_HEIGHT} />
      </div>

      {/* CRT (square): top 9%, left/right 7% => width 335px */}
      <div style={{
        position: "absolute",
        top: HUD_HEIGHT + px(9, CONTENT_HEIGHT) + 10, // 86px + HUD offset (moved down 10px)
        left: px(7, W), // 27px
        width: 335, // W * (1 - 0.14) = 335px
        aspectRatio: "1 / 1",
        background: "#0b2f18", 
        borderRadius: 12, 
        border: "3px solid",
        borderTopColor: "#1a3d24", // darker green for inset top
        borderLeftColor: "#1a3d24", // darker green for inset left
        borderRightColor: "#4a7d5f", // lighter green for inset right
        borderBottomColor: "#4a7d5f", // lighter green for inset bottom 
        boxShadow: "inset 0 3px 6px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.1)", // inset shadow + bottom highlight
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{
          color: "#64ff8a",
          fontFamily: "Menlo, monospace",
          fontSize: 12,
          textAlign: "left",
          width: "100%",
          height: "100%",
          padding: 8,
          overflow: "hidden",
          position: "relative",
        }}>
          {/* Boot sequence or normal display */}
          {booting ? (
            // Show typewriter boot sequence
            <div>
              {bootDisplayLines.map((line, index) => (
                <div key={index} style={{ marginBottom: 2 }}>
                  {line}
                </div>
              ))}
            </div>
          ) : mode === 'terminal' ? (
            // Terminal mode - show last 8 lines or instructions with typewriter
            <div>
              {terminal.length === 0 ? (
                // Show instructions when terminal is empty (with typewriter)
                <TerminalTypewriter lines={[
                  "Click Connect to Connect a Wallet",
                  "Click 'M' for Cartridge Mints", 
                  "Click 'I' for Info",
                  "Click 'L' for Leaderboard"
                ]} />
              ) : (
                // Show terminal lines with typewriter effect
                <TerminalTypewriter lines={[
                  ...terminal.slice(-7), // Show last 7 terminal lines
                  ...(mining ? ['Press > to return to Visualisation'] : []) // Add instruction if mining
                ]} />
              )}
            </div>
          ) : (
            // Visual mode - show 3x3 visualizer
            <Visualizer3x3 nibs={visualizerNibs} />
          )}
          
          {/* Live telemetry when mining (only show in terminal mode) */}
          {/* Commented out obsolete HR/attempts stats box
          {mining && !booting && mode === 'terminal' && (
            <div style={{ 
              position: "absolute",
              bottom: 8,
              left: 8,
              fontSize: 10,
              opacity: 0.8,
              textAlign: "left",
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              padding: "2px 4px",
              borderRadius: 4,
            }}>
              <div>HR: {hr.toLocaleString()}</div>
              <div>A: {attempts.toLocaleString()}</div>
            </div>
          )}
          */}
        </div>
      </div>

      {/* Hash LCD: top 56%, left 7%, width 336px */}
      <div style={{
        position: "absolute", 
        top: px(56, H) - 25 + 20, // Moved down 20px for HUD
        left: px(7, W), // 27px
        width: 336, // 390 - 27 - 27
        background: "#0f2c1b", 
        border: "2px solid",
        borderTopColor: "#1a4d2a", // darker green for inset top
        borderLeftColor: "#1a4d2a", // darker green for inset left  
        borderRightColor: "#3a8a4d", // lighter green for inset right
        borderBottomColor: "#3a8a4d", // lighter green for inset bottom 
        borderRadius: 6, 
        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.1)", // inset shadow + bottom highlight
        padding: "6px 8px"
      }}>
        <div style={{
          color: "#64ff8a", 
          fontSize: 13, 
          letterSpacing: 1, 
          fontFamily: "Menlo, monospace", 
          whiteSpace: "nowrap", 
          overflow: "hidden", 
          textOverflow: "ellipsis"
        }}>
          {hashLcdText}
        </div>
      </div>

      {/* Status LCD: top 61.5%, left 7%, width 148px */}
      <div style={{
        position: "absolute", 
        top: px(61.5, H) - 25 + 20, // Moved down 20px for HUD
        left: px(7, W), // 27px
        width: 148, // 390 - 27 - 215
        background: "#0f2c1b", 
        border: "2px solid",
        borderTopColor: "#1a4d2a", // darker green for inset top
        borderLeftColor: "#1a4d2a", // darker green for inset left  
        borderRightColor: "#3a8a4d", // lighter green for inset right
        borderBottomColor: "#3a8a4d", // lighter green for inset bottom 
        borderRadius: 6, 
        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.1)", // inset shadow + bottom highlight
        padding: "6px 8px"
      }}>
        <div style={{
          color: "#64ff8a", 
          fontSize: 12, 
          letterSpacing: 1, 
          fontFamily: "Menlo, monospace"
        }}>
          {statusLcdText}
        </div>
      </div>

      {/* HashRate LCD: top 61.5%, left 226px, width 137px */}
      <div style={{
        position: "absolute", 
        top: px(61.5, H) - 25 + 20, // Moved down 20px for HUD
        left: 226, // 58% of 390
        width: 137, // 390 - 226 - 27
        background: "#0f2c1b", 
        border: "2px solid",
        borderTopColor: "#1a4d2a", // darker green for inset top
        borderLeftColor: "#1a4d2a", // darker green for inset left  
        borderRightColor: "#3a8a4d", // lighter green for inset right
        borderBottomColor: "#3a8a4d", // lighter green for inset bottom 
        borderRadius: 6, 
        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.1)", // inset shadow + bottom highlight
        padding: "6px 8px"
      }}>
        <div style={{
          color: "#64ff8a", 
          fontSize: 12, 
          letterSpacing: 1, 
          fontFamily: "Menlo, monospace"
        }}>
          {hashRateLcdText}
        </div>
      </div>

      {/* MENU Button: small button in top right */}
      <button
        onClick={() => { playButtonSound(); setShowDebugModal(true); }}
        onPointerDown={(e) => {
          e.currentTarget.style.borderTopColor = "#1a1a1a";
          e.currentTarget.style.borderLeftColor = "#1a1a1a";
          e.currentTarget.style.borderRightColor = "#6a6a6a";
          e.currentTarget.style.borderBottomColor = "#6a6a6a";
          e.currentTarget.style.boxShadow = "inset 0 2px 3px rgba(0,0,0,0.6)";
          e.currentTarget.style.transform = "translateY(2px)";
        }}
        onPointerUp={(e) => {
          e.currentTarget.style.borderTopColor = "#8a8a8a";
          e.currentTarget.style.borderLeftColor = "#8a8a8a";
          e.currentTarget.style.borderRightColor = "#2a2a2a";
          e.currentTarget.style.borderBottomColor = "#2a2a2a";
          e.currentTarget.style.boxShadow = "0 2px 2px rgba(0,0,0,0.5)";
          e.currentTarget.style.transform = "translateY(0)";
        }}
        onPointerLeave={(e) => {
          e.currentTarget.style.borderTopColor = "#8a8a8a";
          e.currentTarget.style.borderLeftColor = "#8a8a8a";
          e.currentTarget.style.borderRightColor = "#2a2a2a";
          e.currentTarget.style.borderBottomColor = "#2a2a2a";
          e.currentTarget.style.boxShadow = "0 2px 2px rgba(0,0,0,0.5)";
          e.currentTarget.style.transform = "translateY(0)";
        }}
        style={{
          position: "absolute",
          bottom: 775, // Aligned with CONNECT button
          right: 207, // Same distance from right as CONNECT is from left
          width: 70,
          height: 27,
          borderRadius: 18,
          border: "2px solid",
          borderTopColor: "#8a8a8a",
          borderLeftColor: "#8a8a8a",
          borderRightColor: "#2a2a2a",
          borderBottomColor: "#2a2a2a",
          cursor: "pointer",
          background: "linear-gradient(145deg, #4a4a4a, #1a1a1a)",
          boxShadow: "0 2px 2px rgba(0,0,0,0.5)",
          fontWeight: 900,
          fontSize: 10,
          letterSpacing: 0.5,
          color: "#ffffff",
          transform: "translateY(0)",
          transition: "transform 120ms, border-color 120ms",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        MENU
      </button>

      {/* ANTI-BOT: Progress LCD (replaces Difficulty LCD) */}
      <div style={{
        position: "absolute", 
        top: px(86.5, H) - 25 + 8, // Moved down 6px (was +2, now +8)
        left: 9, 
        width: 230, 
        height: 29, // 5px taller (was 34, now 29)
        background: "#0f2c1b", 
        border: "2px solid",
        borderTopColor: "#1a4d2a", 
        borderLeftColor: "#1a4d2a", 
        borderRightColor: "#3a8a4d", 
        borderBottomColor: "#3a8a4d", 
        borderRadius: 6, 
        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.1)", 
        padding: "4px 8px",
        display: "flex",
        alignItems: "center"
      }}>
        <div style={{
          color: "#64ff8a", 
          fontSize: 12, // Changed to 12 (was 13)
          letterSpacing: 0.5, 
          fontFamily: "Menlo, monospace",
          whiteSpace: "nowrap", 
          overflow: "hidden", 
          textOverflow: "ellipsis"
        }}>
          {progressText}
        </div>
      </div>

      {/* CONNECT pill: 46px from bottom, left 37px */}
      <div style={{ position: "absolute", left: 17, bottom: 775 }}>
        <button
          onClick={() => { playButtonSound(); handleConnect(); }}
          onPointerDown={() => setConnectPressed(true)}
          onPointerUp={() => setConnectPressed(false)}
          onPointerLeave={() => setConnectPressed(false)}
          style={{
            width: 90, // 90% of 100
            height: 27, // 90% of 30 
            borderRadius: 18, 
            border: "2px solid",
            borderTopColor: connectPressed ? "#1a1a1a" : "#8a8a8a", // top highlight/shadow
            borderLeftColor: connectPressed ? "#1a1a1a" : "#8a8a8a", // left highlight/shadow  
            borderRightColor: connectPressed ? "#6a6a6a" : "#2a2a2a", // right shadow/highlight
            borderBottomColor: connectPressed ? "#6a6a6a" : "#2a2a2a", // bottom shadow/highlight
            cursor: "pointer",
            background: "linear-gradient(145deg, #4a4a4a, #1a1a1a)",
            boxShadow: connectPressed 
              ? "inset 0 2px 3px rgba(0,0,0,0.6)" 
              : "0 2px 2px rgba(0,0,0,0.5)",
            fontWeight: 900, 
            fontSize: 10, // smaller text to fit 90% button
            letterSpacing: 0.5, 
            color: "#ffffff",
            transform: connectPressed ? "translateY(2px)" : "translateY(0)",
            transition: "transform 120ms, border-color 120ms",
          }}
        >
{!isConnected ? 'CONNECT' : 'DISCONNECT'}
        </button>
      </div>



      {/* D-pad Up: moved up 20px for HUD */}
      <div style={{ position: "absolute", left: 92, bottom: 253.5 + 20 }}>
        <DpadButton direction="up" size={38} onPress={() => handleDpad('up')} />
      </div>
      
      {/* D-pad Down: moved up 20px for HUD */}
      <div style={{ position: "absolute", left: 92, bottom: 159.5 + 20 }}>
        <DpadButton direction="down" size={38} onPress={() => handleDpad('down')} />
      </div>
      
      {/* D-pad Left: moved up 20px for HUD */}
      <div style={{ position: "absolute", left: 45, bottom: 206.5 + 20 }}>
        <DpadButton direction="left" size={38} onPress={() => handleDpad('left')} />
      </div>
      
      {/* D-pad Right: moved up 20px for HUD */}
      <div style={{ position: "absolute", left: 139, bottom: 206.5 + 20 }}>
        <DpadButton direction="right" size={38} onPress={() => handleDpad('right')} />
      </div>

      {/* A button: moved up 20px for HUD */}
      <div style={{ position: "absolute", right: 37.5, bottom: 200.5 + 20 }}>
        <ActionButton label="A" onPress={handleA} size={80} variant="primary" />
      </div>

      {/* B button: moved up 20px for HUD */}
      <div style={{ position: "absolute", right: 127.5, bottom: 150.5 + 20 }}>
        <ActionButton label="B" onPress={handleB} size={60} variant="secondary" />
      </div>

      {/* Fan: right 60px, bottom 60px */}
      <div style={{ position: "absolute", right: 19, bottom: 55 }}>
        <FanSandwich spinning={mining} size={110} />
      </div>

      {/* LEDs: top-right row */}
      <div style={{ 
        position: "absolute", 
        top: 37.5 + 80, // Moved down 80px for HUD
        right: 20, 
        display: "flex", 
        gap: 12 
      }}>
        {(() => {
          const hashFound = status === 'found' || !!foundResult || !!lastFound;
          const leds = [
            { label: 'PWR',  on: true },
            { label: 'NET',  on: isConnected },
            { label: 'CRT',  on: !!sessionId },
            { label: 'SHA',  on: hashFound },
            { label: 'MNE',  on: mining && mineBlink },
          ];
          
          return leds.map(({ label, on }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{
                width: 10, 
                height: 10, 
                borderRadius: 10,
                background: on ? "#51ff7a" : "#0b3d21",
                boxShadow: on ? "0 0 6px rgba(81,255,122,0.6)" : "none",
                transition: "all 0.3s ease"
              }} />
              <div style={{
                color: "#2c396f", 
                fontSize: 9, 
                marginTop: 2
              }}>
                {label}
              </div>
            </div>
          ));
        })()}
      </div>

      {/* LED Clone: white bevel effect */}
      <div style={{ 
        position: "absolute", 
        top: 38 + 80, // Moved down 80px for HUD
        right: 19.5, 
        display: "flex", 
        gap: 12 
      }}>
        {(() => {
          const leds = [
            { label: 'PWR' },
            { label: 'NET' },
            { label: 'CRT' },
            { label: 'SHA' },
            { label: 'MNE' },
          ];
          
          return leds.map(({ label }) => (
            <div key={`${label}-clone`} style={{ textAlign: "center" }}>
              <div style={{
                width: 10, 
                height: 10, 
                borderRadius: 10,
                background: "#ffffff",
                opacity: 0.2
              }} />
              <div style={{
                color: "#ffffff", 
                fontSize: 9, 
                marginTop: 2,
                opacity: 0.2
              }}>
                {label}
              </div>
            </div>
          ));
        })()}
      </div>
      
      {/* Cartridge Selection Modal */}
      {showCartridgeSelect && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            border: cooldownTimer ? '2px solid #ff6b6b' : '2px solid #64ff8a',
            borderRadius: 8,
            padding: 20,
            maxWidth: 300,
            width: '90%',
          }}>
            <h3 style={{ color: cooldownTimer ? '#ff6b6b' : '#64ff8a', marginBottom: 8, textAlign: 'center' }}>
              {cooldownTimer ? 'Cartridge Busy' : 'Select Cartridge'}
            </h3>
            
            {cooldownTimer && (
              <div style={{
                color: '#ff6b6b',
                fontSize: '14px',
                textAlign: 'center',
                marginBottom: 16,
                fontFamily: 'Menlo, monospace',
                padding: '8px',
                backgroundColor: 'rgba(255, 107, 107, 0.1)',
                borderRadius: 4,
                border: '1px solid #ff6b6b'
              }}>
                Cartridge is busy for {cooldownTimer}s
                <br />
                <small>Selection will unlock soon...</small>
              </div>
            )}
            
            {/* Load My Cartridges Button */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <button
                onClick={() => {
                  if (cooldownTimer) return; // Disabled during cooldown
                  playButtonSound();
                  setShowAlchemyCartridges(true);
                }}
                disabled={!!cooldownTimer}
                style={{
                  backgroundColor: cooldownTimer ? '#333' : '#4a7d5f',
                  border: cooldownTimer ? '2px solid #666' : '2px solid #64ff8a',
                  borderRadius: 6,
                  color: cooldownTimer ? '#666' : '#64ff8a',
                  padding: '8px 16px',
                  cursor: cooldownTimer ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                  fontFamily: 'Menlo, monospace',
                  fontWeight: 'bold',
                  opacity: cooldownTimer ? 0.5 : 1,
                }}
              >
                🎮 Load My Cartridges
              </button>
            </div>
            
            <div style={{ 
              color: '#888', 
              fontSize: '12px', 
              textAlign: 'center', 
              marginBottom: 16,
              fontFamily: 'Menlo, monospace'
            }}>
              Lock expires in 60s if inactive
            </div>
            {cartridges.map((cart) => {
              // Check if this specific cartridge is locked
              const isThisCartLocked = lockedCartridge && lockedCartridge.contract === cart.contract;
              const lockedTokenId = isThisCartLocked ? lockedCartridge.tokenId : null;
              
              return (
              <div key={cart.contract} style={{ marginBottom: 12 }}>
                <div style={{ color: '#fff', marginBottom: 4 }}>{cart.name}</div>
                <input
                  type="text"
                  placeholder={cooldownTimer ? "Cartridge busy..." : "Token ID"}
                  id={`tokenId-${cart.contract}`}
                  disabled={!!cooldownTimer}
                  style={{
                    width: '100%',
                    padding: 8,
                    backgroundColor: cooldownTimer ? '#1a1a1a' : '#333',
                    border: cooldownTimer ? '1px solid #333' : '1px solid #555',
                    borderRadius: 4,
                    color: cooldownTimer ? '#666' : '#fff',
                    marginBottom: 8,
                    fontFamily: 'Menlo, monospace',
                    opacity: cooldownTimer ? 0.5 : 1,
                    cursor: cooldownTimer ? 'not-allowed' : 'text',
                  }}
                  onKeyDown={(e) => {
                    if (cooldownTimer) return; // Disabled during cooldown
                    if (e.key === 'Enter') {
                      playButtonSound();
                      const tokenId = (e.target as HTMLInputElement).value;
                      if (tokenId) {
                        handleCartridgeSelect(cart, tokenId);
                      }
                    }
                  }}
                />
                
                {/* Number Input Buttons - COMMENTED OUT (Alchemy integration active) */}
                {/* 
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 8 }}>
                  {[1,2,3,4,5,6,7,8,9].map(num => (
                    <button
                      key={num}
                      onClick={() => {
                        playButtonSound();
                        const input = document.getElementById(`tokenId-${cart.contract}`) as HTMLInputElement;
                        if (input) {
                          const currentValue = input.value;
                          if (currentValue.length < 6) {
                            input.value = currentValue + num.toString();
                          }
                        }
                      }}
                      style={{
                        padding: '6px',
                        backgroundColor: '#555',
                        color: 'white',
                        border: '1px solid #777',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontFamily: 'Menlo, monospace',
                        fontSize: 12,
                      }}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 8 }}>
                  <button
                    onClick={() => {
                      playButtonSound();
                      const input = document.getElementById(`tokenId-${cart.contract}`) as HTMLInputElement;
                      const tokenId = input?.value;
                      if (tokenId) {
                        handleCartridgeSelect(cart, tokenId);
                      }
                    }}
                    style={{
                      backgroundColor: '#64ff8a',
                      color: '#000',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 'bold',
                    }}
                  >
                    SUBMIT
                  </button>
                  
                  <button
                    onClick={() => {
                      playButtonSound();
                      const input = document.getElementById(`tokenId-${cart.contract}`) as HTMLInputElement;
                      if (input) {
                        const currentValue = input.value;
                        if (currentValue.length < 6) {
                          input.value = currentValue + '0';
                        }
                      }
                    }}
                    style={{
                      padding: '6px',
                      backgroundColor: '#555',
                      color: 'white',
                      border: '1px solid #777',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontFamily: 'Menlo, monospace',
                      fontSize: 12,
                    }}
                  >
                    0
                  </button>
                  
                  <button
                    onClick={() => {
                      playButtonSound();
                      const input = document.getElementById(`tokenId-${cart.contract}`) as HTMLInputElement;
                      if (input) {
                        input.value = input.value.slice(0, -1);
                      }
                    }}
                    style={{
                      padding: '6px',
                      backgroundColor: '#ff6b6b',
                      color: 'white',
                      border: '1px solid #ff8a8a',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontFamily: 'Menlo, monospace',
                      fontSize: 12,
                    }}
                  >
                    DEL
                  </button>
                </div>
                */}
              </div>
              );
            })}
            
            
            <button
              onClick={() => { playButtonSound(); setShowCartridgeSelect(false); }}
              style={{
                backgroundColor: '#333',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 4,
                cursor: 'pointer',
                width: '100%',
                marginTop: 12,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Cartridge Slot at bottom of shell */}
      <div style={{
        position: "absolute",
        bottom: 57.5,
        left: "46.5%",
        transform: "translateX(-50%)",
        width: 106,
        height: 12,
        background: "linear-gradient(180deg, #1a1a1a, #0a0a0a)",
        borderRadius: "6px 6px 2px 2px",
        border: "1px solid #333",
        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.8)",
        zIndex: 0,
      }}>
        {/* Cartridge slot opening */}
        <div style={{
          position: "absolute",
          top: 2,
          left: 2,
          right: 2,
          bottom: 2,
          background: "#000",
          borderRadius: "4px 4px 1px 1px",
        }} />
      </div>

      {/* Cartridge - shows when connected but no session */}
      {isConnected && !sessionId && (
        <div 
          onClick={() => { playButtonSound(); handleInsertCartridge(); }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateX(-50%) translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 6px 12px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateX(-50%) translateY(0px)";
            e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)";
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = "translateX(-50%) translateY(1px)";
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = "translateX(-50%) translateY(-2px)";
          }}
          style={{
            position: "absolute",
            bottom: 16,
            left: "46.5%",
            transform: "translateX(-50%)",
            width: 96,
            height: 38,
            background: "linear-gradient(145deg, #4a7d5f, #1a3d24)",
            borderRadius: "4px 4px 8px 8px",
            border: "2px solid #2a5a3a",
            cursor: "pointer",
            zIndex: 2,
            transition: "all 0.2s ease",
            boxShadow: "0 4px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Cartridge label */}
          <div style={{
            color: "#fff",
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: 0.5,
            textShadow: "0 1px 2px rgba(0,0,0,0.8)",
          }}>
            CARTRIDGE
          </div>
          
          {/* Cartridge connector lines */}
          <div style={{
            position: "absolute",
            bottom: 36,
            left: "50%",
            transform: "translateX(-50%)",
            width: 86,
            height: 4,
            background: "repeating-linear-gradient(90deg, #666 0px, #666 2px, #333 2px, #333 4px)",
            borderRadius: 1,
          }} />
        </div>
      )}

      {/* Cartridge inserted state - only shows a small portion */}
      {isConnected && sessionId && (
        <div style={{
          position: "absolute",
          bottom: 48,
          left: "46.5%",
          transform: "translateX(-50%)",
          width: 96,
          height: 16,
          background: "linear-gradient(145deg, #4a7d5f, #1a3d24)",
          borderRadius: "0 0 4px 4px",
          border: "2px solid #2a5a3a",
          borderBottom: "4px 4px 0 0",
          zIndex: 0,
          boxShadow: "inset 0 -2px 4px rgba(0,0,0,0.4)",
        }}>
          {/* Small visible label */}
          <div style={{
            color: "#fff",
            fontSize: 0,
            fontWeight: 900,
            letterSpacing: 0.3,
            textAlign: "center",
            marginTop: 1,
            textShadow: "0 1px 1px rgba(0,0,0,0.8)",
          }}>
            CART
          </div>
        </div>
      )}

      {/* Claim Overlay */}
      {lastFound && (
        <ClaimOverlay />
      )}

      {/* Job Expired Popup */}
      {showJobExpired && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            border: '2px solid #ff6b6b',
            borderRadius: 8,
            padding: 20,
            textAlign: 'center',
            maxWidth: 300,
            color: '#fff',
            fontFamily: 'Menlo, monospace',
          }}>
            <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#ff6b6b' }}>
              JOB EXPIRED
            </div>
            <div style={{ marginBottom: 20, fontSize: 14 }}>
              The mining job has expired. What would you like to do?
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => { playButtonSound(); handleGetNewJob(); }}
                style={{
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontFamily: 'Menlo, monospace',
                  fontSize: 12,
                }}
              >
                GET NEW JOB
              </button>
              <button
                onClick={() => { playButtonSound(); handleReinsertCartridge(); }}
                style={{
                  backgroundColor: '#ff6b6b',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontFamily: 'Menlo, monospace',
                  fontSize: 12,
                }}
              >
                RE-INSERT CART
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debug Modal */}
      {showDebugModal && (
        <>
          <style jsx>{`
            .debug-modal::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div 
            className="debug-modal"
            style={{
              backgroundColor: '#1a3d24',
              border: '3px solid #4a7d5f',
              borderRadius: '12px',
              padding: '20px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              scrollbarWidth: 'none', /* Firefox */
              msOverflowStyle: 'none', /* IE and Edge */
              fontFamily: 'Menlo, monospace',
              color: '#c8ffc8',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)'
            }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              borderBottom: '2px solid #4a7d5f',
              paddingBottom: '10px'
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '18px',
                color: '#4a7d5f',
                textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
              }}>
                DEBUG INFO
              </h2>
              <button
                onClick={() => { playButtonSound(); setShowDebugModal(false); }}
                style={{
                  background: 'linear-gradient(145deg, #ff6b6b, #d63031)',
                  color: 'white',
                  border: '2px solid #8a8a8a',
                  borderRadius: '6px',
                  width: '30px',
                  height: '30px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(145deg, #d63031, #ff6b6b)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(145deg, #ff6b6b, #d63031)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(145deg, #ff6b6b, #d63031)';
                }}
              >
                ×
              </button>
            </div>

            {/* Debug Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Sound Settings - moved to top */}
              <SoundSettings />

              {/* Statistics Section */}
              <StatisticsSection />

              {/* Show Welcome Page Button */}
              <div style={{
                padding: '12px',
                background: 'linear-gradient(180deg, #1a3d24, #0f2216)',
                border: '2px solid #4a7d5f',
                borderRadius: '8px'
              }}>
                <h3 style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#4a7d5f' }}>
                  WELCOME PAGE
                </h3>
                <button
                  onClick={() => {
                    playButtonSound();
                    setShowDebugModal(false);
                    openNavigationPage('welcome');
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
                    color: '#c8ffc8',
                    border: '2px solid #64ff8a',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    fontFamily: 'Menlo, monospace'
                  }}
                >
                  🎮 Show Welcome Page
                </button>
              </div>

              <div style={{
                padding: '12px',
                background: 'linear-gradient(180deg, #0f2216, #1a3d24)',
                border: '2px solid #4a7d5f',
                borderRadius: '8px'
              }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#4a7d5f' }}>
                  SESSION INFO
                </div>
                <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
                  <div><strong>Session ID:</strong> {sessionId ? `${sessionId.slice(0, 8)}...${sessionId.slice(-6)}` : 'None'}</div>
                  <div><strong>Miner ID:</strong> {getOrCreateMinerId().slice(0, 8)}...{getOrCreateMinerId().slice(-6)}</div>
                  <div><strong>Wallet:</strong> {wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : 'Not connected'}</div>
                  <div><strong>Status:</strong> {status}</div>
                  <div><strong>Mining:</strong> {mining ? 'Yes' : 'No'}</div>
                </div>
              </div>

              <div style={{
                padding: '12px',
                background: 'linear-gradient(180deg, #0f2216, #1a3d24)',
                border: '2px solid #4a7d5f',
                borderRadius: '8px'
              }}>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: 'bold', 
                  marginBottom: '8px', 
                  color: '#4a7d5f',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  LOCK INFO
                  <button
                    onClick={() => { playButtonSound(); fetchLockInfo(); }}
                    style={{
                      background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
                      color: '#c8ffc8',
                      border: '1px solid #8a8a8a',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      cursor: 'pointer',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      fontFamily: 'Menlo, monospace'
                    }}
                  >
                    REFRESH
                  </button>
                </div>
                <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
                  {cartridge ? (
                    <>
                      {lockInfo ? (
                        <>
                          <div><strong>Ownership Lock:</strong> {lockInfo.ownershipLock.active ? 'Active' : 'Inactive'} ({Math.ceil(lockInfo.ownershipLock.ttl / 60)}m TTL)</div>
                          <div><strong>Session Lock:</strong> {lockInfo.sessionLock.active ? 'Active' : 'Inactive'} ({lockInfo.sessionLock.ttl}s TTL)</div>
                          <div><strong>Lock Owner:</strong> {lockInfo.ownershipLock.owner ? `${lockInfo.ownershipLock.owner.slice(0, 6)}...${lockInfo.ownershipLock.owner.slice(-4)}` : 'Unknown'}</div>
                          <div><strong>Session ID:</strong> {lockInfo.sessionLock.sessionId ? `${lockInfo.sessionLock.sessionId.slice(0, 8)}...${lockInfo.sessionLock.sessionId.slice(-6)}` : 'None'}</div>
                          <div><strong>Wallet Sessions:</strong> {lockInfo.walletSessions.active}/{lockInfo.walletSessions.limit}</div>
                          <div><strong>Expires:</strong> {new Date(lockInfo.ownershipLock.expiresAt).toLocaleTimeString()}</div>
                        </>
                      ) : (
                        <>
                          <div><strong>Ownership Lock:</strong> Active (1h TTL)</div>
                          <div><strong>Session Lock:</strong> Active (60s TTL)</div>
                          <div><strong>Lock Owner:</strong> {wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : 'Unknown'}</div>
                          <div><strong>Per-Tab Session:</strong> {cartridge ? getOrCreateSessionId(parseInt(cartridge.tokenId)).slice(0, 8) + '...' + getOrCreateSessionId(parseInt(cartridge.tokenId)).slice(-6) : 'None'}</div>
                          <div><strong>Wallet Sessions:</strong> Active (click REFRESH for details)</div>
                        </>
                      )}
                    </>
                  ) : (
                    <div>No cartridge - no locks</div>
                  )}
                </div>
              </div>

              <div style={{
                padding: '12px',
                background: 'linear-gradient(180deg, #0f2216, #1a3d24)',
                border: '2px solid #4a7d5f',
                borderRadius: '8px'
              }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#4a7d5f' }}>
                  JOB INFO
                </div>
                <div style={{ fontSize: '10px', color: '#6a8d7f', marginBottom: '8px' }}>
                  Job ID = server handle • Counter = window position
                </div>
                <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
                  {job ? (
                    <>
                      <div><strong>Job ID:</strong> {job?.id ? `${job.id.slice(0, 12)}...${job.id.slice(-7)}` : 'N/A'}</div>
                      <div><strong>Nonce (local):</strong> N/A</div>
                      <div><strong>Difficulty:</strong> {job.target?.length ? `${job.target.length * 4} bits (from suffix)` : 'N/A'}</div>
                      <div><strong>Target:</strong> {job.target || '00000'}</div>
                      <div><strong>Time Remaining:</strong> {ttlSec != null ? `${ttlSec}s` : 'N/A'}</div>
                      {job.allowedSuffixes && (
                        <>
                          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #4a7d5f' }}>
                            <strong>Allowed Suffixes:</strong> {job.allowedSuffixes.length} patterns
                          </div>
                          <div style={{ fontSize: '10px', color: '#6a8d7f', wordBreak: 'break-all' }}>
                            {job.allowedSuffixes.slice(0, 8).join(', ')}{job.allowedSuffixes.length > 8 ? '...' : ''}
                          </div>
                        </>
                      )}
                      {job.counterStart !== undefined && job.counterEnd !== undefined && (
                        <>
                          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #4a7d5f' }}>
                            <strong>Counter Window:</strong> [{job.counterStart.toLocaleString()}, {job.counterEnd.toLocaleString()})
                          </div>
                          <div style={{ fontSize: '10px', color: '#6a8d7f' }}>
                            Window Size: {(job.counterEnd - job.counterStart).toLocaleString()} hashes
                          </div>
                        </>
                      )}
                      {job.maxHps && (
                        <div style={{ marginTop: '4px' }}>
                          <strong>Max Rate:</strong> {job.maxHps.toLocaleString()} H/s
                        </div>
                      )}
                    </>
                  ) : (
                    <div>No active job</div>
                  )}
                </div>
              </div>

              {/* ANTI-BOT STATUS */}
              <div style={{
                padding: '12px',
                background: 'linear-gradient(180deg, #0f2216, #1a3d24)',
                border: '2px solid #4a7d5f',
                borderRadius: '8px'
              }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#4a7d5f' }}>
                  🛡️ ANTI-BOT STATUS
                </div>
                <div style={{ fontSize: '10px', color: '#6a8d7f', marginBottom: '8px' }}>
                  Security measures to ensure fair play
                </div>
                <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
                  <div><strong>Physics Validation:</strong> ✅ Active (85% slack)</div>
                  <div><strong>Rate Limit (Wallet):</strong> 10 jobs/minute</div>
                  <div><strong>Rate Limit (Network):</strong> 50 jobs/minute</div>
                  <div><strong>Counter Window:</strong> {job?.counterStart !== undefined && job?.counterEnd !== undefined ? `${(job.counterEnd - job.counterStart).toLocaleString()} hashes` : 'N/A'}</div>
                  <div><strong>Work Binding:</strong> ✅ wallet+tokenId</div>
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #4a7d5f', fontSize: '10px', color: '#ffa500' }}>
                    ⚠️  Exceeding limits results in cooldown penalties
                  </div>
                </div>
              </div>

              <div style={{
                padding: '12px',
                background: 'linear-gradient(180deg, #0f2216, #1a3d24)',
                border: '2px solid #4a7d5f',
                borderRadius: '8px'
              }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#4a7d5f' }}>
                  MINING STATS
                </div>
                <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
                  <div><strong>Attempts:</strong> {attempts.toLocaleString()}</div>
                  <div><strong>Hash Rate:</strong> {hr.toLocaleString()} H/s</div>
                  <div><strong>Last Found:</strong> {lastFound ? 'Yes' : 'No'}</div>
                  {lastFound && (
                    <>
                      <div><strong>Found Hash:</strong> {lastFound.hash.slice(0, 8)}...{lastFound.hash.slice(-6)}</div>
                      <div><strong>Found Attempts:</strong> {lastFound.attempts.toLocaleString()}</div>
                    </>
                  )}
                </div>
              </div>

              <div style={{
                padding: '12px',
                background: 'linear-gradient(180deg, #0f2216, #1a3d24)',
                border: '2px solid #4a7d5f',
                borderRadius: '8px'
              }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#4a7d5f' }}>
                  CARTRIDGE INFO
                </div>
                <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
                  {cartridge ? (
                    <>
                      <div><strong>Name:</strong> {cartridge.info.name}</div>
                      <div><strong>Token ID:</strong> {cartridge.tokenId}</div>
                      <div><strong>Contract:</strong> {cartridge.info.contract.slice(0, 6)}...{cartridge.info.contract.slice(-4)}</div>
                      <div><strong>Chain ID:</strong> {cartridge.info.chainId}</div>
                    </>
                  ) : (
                    <div>No cartridge inserted</div>
                  )}
                </div>
              </div>

              <div style={{
                padding: '12px',
                background: 'linear-gradient(180deg, #0f2216, #1a3d24)',
                border: '2px solid #4a7d5f',
                borderRadius: '8px'
              }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#4a7d5f' }}>
                  WALLET BALANCE
                </div>
                <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
                  <div><strong>MNESTR:</strong> {mnestrBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div><strong>NPC NFTs:</strong> {npcBalance}</div>
                </div>
              </div>
            </div>



            {/* Footer */}
            <div style={{
              marginTop: '20px',
              paddingTop: '10px',
              borderTop: '2px solid #4a7d5f',
              textAlign: 'center'
            }}>
              <button
                onClick={() => { playButtonSound(); setShowDebugModal(false); }}
                style={{
                  background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
                  color: '#c8ffc8',
                  border: '2px solid #8a8a8a',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  fontFamily: 'Menlo, monospace',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(145deg, #1a3d24, #4a7d5f)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(145deg, #4a7d5f, #1a3d24)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(145deg, #4a7d5f, #1a3d24)';
                }}
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
        </>
      )}

        {/* MineBoy Branding */}
        <div style={{
          position: 'absolute',
          bottom: '67.5px',
          left: '42.2%',
          transform: 'translateX(-50%) translateX(5px) skewX(10deg)',
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#2c396f',
          textShadow: `
            2px 2px 0px #1a2447,
            4px 4px 0px #0f1a3a,
            6px 6px 0px #0a1229,
            inset 0px 1px 0px rgba(255,255,255,0.4),
            inset 0px -1px 0px rgba(0,0,0,0.6)
          `,
          letterSpacing: '3px',
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          pointerEvents: 'none',
          zIndex: 10
        }}>
          <span style={{ fontSize: '26px' }}>M</span>INE<span style={{ fontSize: '26px' }}>B</span>OY
        </div>

      {/* MineBoy Branding - White Clone */}
      <div style={{
        position: 'absolute',
        bottom: '67px',
        left: '42.45%',
        transform: 'translateX(-50%) translateX(5px) skewX(10deg)',
        fontSize: '24px',
        fontWeight: 'bold',
        color: 'rgba(255,255,255,0.2)',
        letterSpacing: '3px',
        fontFamily: 'monospace',
        textTransform: 'uppercase',
        pointerEvents: 'none',
        zIndex: 9
      }}>
        <span style={{ fontSize: '26px' }}>M</span>INE<span style={{ fontSize: '26px' }}>B</span>OY
      </div>

      {/* NPC Simple Art */}
      <div style={{
        position: 'absolute',
        bottom: '47.5px',
        right: '300px',
        width: '54px',
        height: '54px',
        zIndex: 10,
        pointerEvents: 'none'
      }}>
        <NPCSimple 
          fill="#3f4c80"
          style={{ 
            transform: 'scaleX(-1) skewX(-7.5deg)'
          }}
        />
      </div>

      {/* NPC Simple Art - White Clone */}
      <div style={{
        position: 'absolute',
        bottom: '46.9px',
        right: '299px',
        width: '54px',
        height: '54px',
        zIndex: 9,
        pointerEvents: 'none'
      }}>
        <NPCSimple 
          fill="rgba(255, 255, 255, 0.1)"
          style={{ 
            transform: 'scaleX(-1) skewX(-7.5deg)'
          }}
        />
      </div>

      
      {/* Mobile Zoom Toggle - COMMENTED OUT FOR TESTING */}
      {/* <button
        onClick={() => setMobileZoom(!mobileZoom)}
        style={{
          position: 'fixed',
          left: '0px',
          top: '21.55%',
          transform: 'translateY(-50%)',
          zIndex: 0, // Behind the shell
          width: '10px',
          height: '109.5px',
          background: 'linear-gradient(145deg, #cc6666, #aa4444)',
          border: 'none',
          borderRadius: '10px',
          cursor: 'pointer',
          boxShadow: `
            inset 2px 2px 4px rgba(255, 255, 255, 0.3),
            inset -2px -2px 4px rgba(0, 0, 0, 0.3),
            0 4px 8px rgba(0,0,0,0.4)
          `,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'linear-gradient(145deg, #dd7777, #bb5555)';
          e.currentTarget.style.height = '90px';
          e.currentTarget.style.boxShadow = `
            inset 2px 2px 4px rgba(255, 255, 255, 0.4),
            inset -2px -2px 4px rgba(0, 0, 0, 0.2),
            0 6px 12px rgba(0,0,0,0.5)
          `;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'linear-gradient(145deg, #cc6666, #aa4444)';
          e.currentTarget.style.height = '109.5px';
          e.currentTarget.style.boxShadow = `
            inset 2px 2px 4px rgba(255, 255, 255, 0.3),
            inset -2px -2px 4px rgba(0, 0, 0, 0.3),
            0 4px 8px rgba(0,0,0,0.4)
          `;
        }}
      /> */}
      
      {/* Alchemy Cartridge Selection Modal */}
      <CartridgeSelectionModal
        isOpen={showAlchemyCartridges}
        onClose={() => setShowAlchemyCartridges(false)}
        onSelectCartridge={handleAlchemyCartridgeSelect}
        lockedCartridge={lockedCartridge}
      />

      {/* Navigation Modal */}
      <NavigationModal
        isOpen={showNavigationModal}
        page={navigationPage}
        onClose={closeNavigationModal}
      />

      {/* Eject Cart Confirmation Modal */}
      {showEjectConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
          onClick={() => setShowEjectConfirm(false)}
        >
          <div
            style={{
              background: 'linear-gradient(145deg, #1a3d24, #0f2c1b)',
              border: '3px solid #3a8a4d',
              borderRadius: 12,
              padding: '32px',
              maxWidth: '400px',
              textAlign: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              color: '#64ff8a',
              fontSize: '20px',
              fontWeight: 'bold',
              marginBottom: '16px',
              fontFamily: 'Menlo, monospace',
            }}>
              ⚠️ EJECT CARTRIDGE?
            </div>
            <div style={{
              color: '#c8ffc8',
              fontSize: '14px',
              marginBottom: '24px',
              lineHeight: '1.5',
            }}>
              This will end your mining session and reload the page.
            </div>
            <div style={{
              display: 'flex',
              gap: '16px',
              justifyContent: 'center',
            }}>
              <button
                onClick={confirmEjectCart}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(145deg, #cc4444, #aa2222)',
                  border: '2px solid #ff6666',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(145deg, #dd5555, #bb3333)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(145deg, #cc4444, #aa2222)';
                }}
              >
                YES, EJECT
              </button>
              <button
                onClick={() => setShowEjectConfirm(false)}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
                  border: '2px solid #3a8a4d',
                  borderRadius: 8,
                  color: '#c8ffc8',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(145deg, #5a8d6f, #2a4d34)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(145deg, #4a7d5f, #1a3d24)';
                }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paid Message Modal */}
      <PaidMessageModal
        isOpen={showPaidMessageModal}
        onClose={() => setShowPaidMessageModal(false)}
        onMessageSubmitted={fetchMessages}
      />

      {/* MineStrategy Flywheel Modal */}
      <MineStrategyModal
        isOpen={showMineStrategyModal}
        onClose={() => setShowMineStrategyModal(false)}
      />
    </Stage>
  );
}

export default dynamic(() => Promise.resolve(Home), { ssr: false });
// Force redeploy Tue Sep 16 03:02:26 BST 2025 - Fixed router address to use env var
