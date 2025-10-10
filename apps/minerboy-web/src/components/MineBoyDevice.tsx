// MineBoyDevice.tsx - Complete self-contained MineBoy device
// Extracted from page.tsx - All device-specific logic, state, and UI
"use client";

import { useState, useEffect, useCallback, useRef, forwardRef } from "react";
import HUD from "@/components/HUD";
import ActionButton from "@/components/ui/ActionButton";
import DpadButton from "@/components/ui/DpadButton";
import FanSandwich from "@/components/ui/FanSandwich";
import SideButton from "@/components/ui/SideButton";
import PaidMessageModal from "@/components/PaidMessageModal";
import MineStrategyModal from "@/components/MineStrategyModal";
import EnhancedShell from "@/components/art/EnhancedShell";
import CartridgeModalV2 from "@/components/CartridgeModalV2";
import ClaimOverlay from "@/components/ClaimOverlay";
import Visualizer3x3 from "@/components/Visualizer3x3";
import CartridgeSelectionModal from '@/components/CartridgeSelectionModal';
import SoundSettings from '@/components/SoundSettings';
import StatisticsSection from '@/components/StatisticsSection';
import { useActiveAccount } from '@/hooks/useActiveAccount';
import { useActiveDisconnect } from '@/hooks/useActiveDisconnect';
import { useActiveWalletClient } from '@/hooks/useActiveWalletClient';
import { useSession, getOrCreateMinerId } from "@/state/useSession";
import { useMinerStore } from "@/state/miner";
import { useMinerWorker } from "@/hooks/useMinerWorker";
import { useTypewriter } from "@/hooks/useTypewriter";
import { useJobTtl } from "@/hooks/useJobTtl";
import { useNPCBalance } from "@/hooks/useNPCBalance";
import { api, apiGetIndividualLeaderboard, type CartridgeConfig } from "@/lib/api";
import { heartbeat } from "@/utils/HeartbeatController";
import { getOwnedCartridges, type OwnedCartridge } from '@/lib/alchemy';
import { getMinerIdCached } from "@/utils/minerId";
import { getJobId, assertString } from "@/utils/job";
import { getOrCreateSessionId } from '@/lib/miningSession';
import { apiStart, apiHeartbeat } from '@/lib/miningApi';
import { normalizeJob } from '@/lib/normalizeJob';
import { to0x, hexFrom } from "@/lib/hex";
import { playButtonSound, playConfirmSound, playFailSound, startMiningSound, stopMiningSound } from '@/lib/sounds';
import { useWriteContract, useReadContract } from 'wagmi';
import type { MiningJob as Job } from "@/types/mining";
import RouterV3ABI from '@/abi/RouterV3.json';
import RouterV3_1ABI from '@/lib/RouterV3_1ABI.json';

// =============================================================================
// TYPES & CONSTANTS
// =============================================================================

export type MineBoyColor = 'blue' | 'orange' | 'green';

type FoundResult = {
  hash: string;
  preimage: string;
  attempts: number;
  hr: number;
};

const W = 390;
const H = 924;
const HUD_HEIGHT = 80;
const CONTENT_HEIGHT = 844;
const px = (p: number, total: number) => Math.round(total * p / 100);

// Terminal typewriter component
function TerminalTypewriter({ lines }: { lines: string[] }) {
  const { displayLines } = useTypewriter(lines, 15, 50);
  return (
    <div>
      {displayLines.map((line, index) => (
        <div key={index} style={{ marginBottom: 2, opacity: index < 2 ? 0.6 : 1 }}>
          {line}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// COMPONENT PROPS
// =============================================================================

export interface MineBoyDeviceProps {
  cartridge?: OwnedCartridge; // Optional - device can exist without cartridge inserted
  color: MineBoyColor;
  isActive: boolean;
  onEject: () => void;
  playButtonSound: () => void;
  onCartridgeSelected?: (cartridge: OwnedCartridge) => void; // Callback when user selects a cartridge
  
  // Shared from parent
  vaultAddress?: string;
  scrollingMessages?: Array<string | { text: string; color?: string; prefix?: string; type?: string }>;
  seasonPoints?: number;
  
  // Modal handlers passed from parent (global modals)
  onOpenWalletModal?: () => void;
  onOpenNavigationModal?: (page: 'leaderboard' | 'mint' | 'instructions' | 'welcome') => void;
  
  className?: string;
  style?: React.CSSProperties;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const MineBoyDevice = forwardRef<HTMLDivElement, MineBoyDeviceProps>(
  ({ 
    cartridge, 
    color, 
    isActive, 
    onEject,
    playButtonSound,
    onCartridgeSelected,
    vaultAddress = '',
    scrollingMessages = ["MineBoy™ it Mines stuff!"],
    seasonPoints = 0,
    onOpenWalletModal,
    onOpenNavigationModal,
    className, 
    style 
  }, ref) => {
    
    // =========================================================================
    // STATE - All device-local state
    // =========================================================================
    
    const [connectPressed, setConnectPressed] = useState(false);
    const [showJobExpired, setShowJobExpired] = useState(false);
    const [showDebugModal, setShowDebugModal] = useState(false);
    const [pendingClaimId, setPendingClaimId] = useState<string | null>(null);
    const [booting, setBooting] = useState(true);
    const [lockInfo, setLockInfo] = useState<any>(null);
    const [showEjectConfirm, setShowEjectConfirm] = useState(false);
    const [ejectButtonPressed, setEjectButtonPressed] = useState(false);
    const [cooldownTimer, setCooldownTimer] = useState<number | null>(null);
    const [showPaidMessageModal, setShowPaidMessageModal] = useState(false);
    const [showMineStrategyModal, setShowMineStrategyModal] = useState(false);
    const [mineBlink, setMineBlink] = useState(false);
    const [status, setStatus] = useState<'idle'|'mining'|'found'|'claiming'|'claimed'|'error'>('idle');
    const [foundResult, setFoundResult] = useState<FoundResult | null>(null);
    const [miningProgress, setMiningProgress] = useState(0);
    const [miningEta, setMiningEta] = useState(0);
    const [currentDisplayHash, setCurrentDisplayHash] = useState('0x000000000000000000000000000000000000000000000000000000000000000000');
    const [visualizerNibs, setVisualizerNibs] = useState<Array<{ nib: number; found: boolean }>>([]);
    const [showCartridgeModalV2, setShowCartridgeModalV2] = useState(false);
    const [showAlchemyCartridges, setShowAlchemyCartridges] = useState(false);
    const [progressText, setProgressText] = useState('No job');
    const [localVaultAddress, setLocalVaultAddress] = useState(vaultAddress);
    
    // Sync vault prop to local state
    useEffect(() => {
      if (vaultAddress !== localVaultAddress) {
        setLocalVaultAddress(vaultAddress || '');
      }
    }, [vaultAddress]);
    
    // =========================================================================
    // WALLET & ACCOUNT
    // =========================================================================
    
    const { address, isConnected, provider } = useActiveAccount();
    const { disconnectWallet } = useActiveDisconnect();
    const walletClient = useActiveWalletClient();
    const { writeContract, writeContractAsync, data: hash } = useWriteContract();
    
    const { npcBalance } = useNPCBalance((localVaultAddress || address) as `0x${string}` | undefined);
    
    const { data: mnestrBalanceRaw } = useReadContract({
      address: '0xAe0DfbB1a2b22080F947D1C0234c415FabEEc276' as `0x${string}`,
      abi: [{
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
      }] as const,
      functionName: 'balanceOf',
      args: address ? [address] : undefined,
      query: { enabled: !!address },
    });
    
    const mnestrBalance = mnestrBalanceRaw ? Number(mnestrBalanceRaw) / 1e18 : 0;
    
    // =========================================================================
    // SESSION STATE
    // =========================================================================
    
    const { 
      wallet,
      cartridge: sessionCartridge,
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
    
    const { bootLines, stopMining: storeStopMining, setHashRate } = useMinerStore();
    
    // =========================================================================
    // MINER WORKER
    // =========================================================================
    
    const miner = useMinerWorker({
      onTick: (data) => {
        setTelemetry(data.attempts, data.hr);
        if (data.hash) setCurrentDisplayHash(data.hash);
        if (data.nibs && data.nibs.length === 9) {
          setVisualizerNibs(data.nibs.map(nib => ({ nib, found: false })));
        }
        if (data.progress !== undefined) setMiningProgress(data.progress);
        if (data.estimatedSecondsLeft !== undefined) setMiningEta(data.estimatedSecondsLeft);
      },
      onFound: ({ hash, preimage, attempts, hr }) => {
        setMining(false);
        setStatus('found');
        stopMiningSound();
        const frozenResult = { hash, preimage, attempts, hr };
        setFoundResult(frozenResult);
        setFound({ hash: hash as `0x${string}`, preimage, attempts, hr });
        playConfirmSound();
        pushLine(`Found hash: ${hash.slice(0, 10)}...`);
        pushLine(`Press B to submit solution`);
        setMode('visual');
        console.log('[MineBoyDevice][FOUND]', { color, tokenId: cartridge?.tokenId, result: frozenResult });
      },
      onError: (message) => {
        pushLine(`Error: ${message}`);
        setMining(false);
        setStatus('error');
        stopMiningSound();
      },
      onStopped: async (reason) => {
        console.log('[MineBoyDevice][STOPPED]', { color, tokenId: cartridge?.tokenId, reason });
        
        if (reason === 'window_exhausted') {
          storeStopMining();
          setMining(false);
          setStatus('idle');
          stopMiningSound();
          playFailSound();
          setFoundResult(null);
          setFound(undefined);
          setCurrentDisplayHash('0x000000000000000000000000000000000000000000000000000000000000000000');
          setHashRate(0);
          clear();
          setMode('terminal');
          pushLine('⏰ MINING TIMEOUT!');
          pushLine('Failed to find hash in time window');
          pushLine('Cartridge locked for 60 seconds');
          pushLine(' ');
          pushLine('Wait for cooldown to finish');
          miner.resetSession();
        } else if (reason === 'manual_stop') {
          storeStopMining();
          setMining(false);
          setStatus('idle');
          stopMiningSound();
        }
      },
    });
    
    // =========================================================================
    // LIFECYCLE: Cleanup - only re-register when sessionId changes
    // =========================================================================
    
    useEffect(() => {
      // This effect's cleanup will run when sessionId changes OR on unmount
      // We need sessionId in deps so cleanup uses the CURRENT sessionId
      return () => {
        console.log(`[MineBoyDevice] Cleaning up ${color} device (sessionId: ${sessionId || 'none'})`);
        miner.stop();
        if (sessionId) {
          api.close(sessionId).catch(console.error);
        }
      };
    }, [sessionId]); // Only sessionId in deps - cartridge changes don't trigger cleanup
    
    // =========================================================================
    // SESSION OPENING: When cartridge is inserted, open a session
    // =========================================================================
    
    useEffect(() => {
      // Only run when we have a cartridge but no session (i.e., cartridge just inserted)
      if (!cartridge || sessionId || !address) return;
      
      const openSession = async () => {
        try {
          clear();
          pushLine(`Opening session with ${cartridge.metadata?.type || 'cartridge'}...`);
          
          const sid = getOrCreateSessionId(parseInt(cartridge.tokenId));
          const chainId = cartridge.chainId;
          const contract = cartridge.contractAddress as `0x${string}`;
          const minerId = getMinerIdCached();
          
          console.log('[SESSION_OPEN] Starting session:', {
            sessionId: sid,
            wallet: address,
            chainId,
            contract,
            tokenId: cartridge.tokenId,
            minerId
          });
          
          const res = await apiStart({
            wallet: address as `0x${string}`,
            chainId,
            contract,
            tokenId: parseInt(cartridge.tokenId),
            sessionId: sid,
            minerId,
            vault: localVaultAddress || undefined
          });
          
          console.log('[SESSION_OPEN] Success:', res);
          
          // Create a compatible session object
          const compatibleSession = {
            sessionId: res.sessionId,
            job: res.job ? normalizeJob(res.job as any) : undefined
          };
          
          loadOpenSession(compatibleSession, address, { 
            info: { 
              chainId, 
              contract, 
              name: cartridge.metadata?.type || 'Unknown',
              multiplier: cartridge.metadata?.multiplier || 1 
            } as CartridgeConfig, 
            tokenId: cartridge.tokenId, 
            metadata: cartridge.metadata 
          });
          
          pushLine(`Session opened! Job ID: ${res.job?.id || 'unknown'}`);
          
        } catch (error: any) {
          console.error('[SESSION_OPEN] Error:', error);
          
          // Parse error info
          let errorInfo = error.info || error;
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
          }
          
          console.log('[SESSION_OPEN] Parsed error info:', errorInfo);
          
          // Handle error cases
          if (errorInfo.code === 'cartridge_in_use') {
            const minutes = errorInfo.remainingMinutes || 'unknown';
            pushLine(`🔒 Cartridge locked for ~${minutes} minutes.`);
            pushLine('Try another cartridge or wait.');
            onEject(); // Eject this cartridge so user can select another
            return;
          }
          
          if (errorInfo.code === 'session_conflict') {
            const ttlSec = errorInfo.details?.ttlSec || 60;
            pushLine(`🔒 SESSION CONFLICT`);
            pushLine(`This cartridge is mining elsewhere.`);
            pushLine(`Locked for ${ttlSec}s`);
            onEject();
            return;
          }
          
          if (errorInfo.code === 'session_still_active' || errorInfo.code === 'active_session_elsewhere') {
            pushLine('⚠️ Active session elsewhere');
            onEject();
            return;
          }
          
          if (error.status === 429) {
            pushLine('⚠️ Rate limited. Slow down!');
            return;
          }
          
          // Generic error
          pushLine(`Session open failed: ${errorInfo.message || error.message || 'Unknown error'}`);
          onEject();
        }
      };
      
      openSession();
    }, [cartridge, sessionId, address]); // Run when cartridge/address change, but only if no session yet
    
    // =========================================================================
    // SESSION LOGGING (Dev mode)
    // =========================================================================
    
    useEffect(() => {
      if (process.env.NODE_ENV === 'development' && sessionId && mining) {
        console.log(`[MineBoyDevice][${color}] Mining:`, {
          sessionId: sessionId.slice(0, 8) + '...',
          tokenId: cartridge?.tokenId,
          minerId: getMinerIdCached().slice(0, 8) + '...',
          isActive,
          hr,
          attempts,
        });
      }
    }, [sessionId, cartridge?.tokenId, color, isActive, mining, hr, attempts]);
    
    // =========================================================================
    // BOOT SEQUENCE
    // =========================================================================
    
    const { displayLines: bootDisplayLines } = useTypewriter(
      booting ? bootLines : [],
      18,
      180,
      () => setBooting(false)
    );
    
    useEffect(() => {
      if (booting) {
        const timer = setTimeout(() => setBooting(false), 8000);
        return () => clearTimeout(timer);
      }
    }, [booting]);
    
    // =========================================================================
    // EFFECTS: Mine blink, cooldown, heartbeat
    // =========================================================================
    
    useEffect(() => {
      if (!mining) { 
        setMineBlink(false); 
        return; 
      }
      const id = setInterval(() => setMineBlink(b => !b), 400);
      return () => clearInterval(id);
    }, [mining]);
    
    useEffect(() => {
      if (cooldownTimer === null || cooldownTimer <= 0) return;
      const interval = setInterval(() => {
        setCooldownTimer(prev => {
          if (prev === null || prev <= 1) return null;
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }, [cooldownTimer]);
    
    // Heartbeat
    useEffect(() => {
      if (!sessionId || !cartridge) return;
      
      const heartbeatFn = async () => {
        try {
          if (!address || !cartridge) return;
          const chainId = cartridge.chainId;
          const contract = cartridge.contractAddress as `0x${string}`;
          const minerId = getMinerIdCached();
          const sid = getOrCreateSessionId(parseInt(cartridge.tokenId));
          
          await apiHeartbeat({
            wallet: address as `0x${string}`,
            chainId,
            contract,
            tokenId: parseInt(cartridge.tokenId),
            sessionId: sid,
            minerId
          });
        } catch (error: any) {
          console.warn('[Heartbeat] Failed:', error);
          if (error.status === 404 || error.status === 409) {
            pushLine('Heartbeat Failed');
            pushLine('Session expired');
            miner.stopForTtl();
            storeStopMining();
            setMining(false);
            stopMiningSound();
            playFailSound();
            setCurrentDisplayHash('0x000000000000000000000000000000000000000000000000000000000000000000');
            setHashRate(0);
            setCooldownTimer(60);
            clear();
            setStatus('idle');
          }
        }
      };
      
      heartbeat.start(heartbeatFn, 2000);
      return () => heartbeat.stop();
    }, [sessionId, address, cartridge]);
    
    // TX hash watcher
    useEffect(() => {
      if (!pendingClaimId || !hash) return;
      let cancelled = false;
      
      const submit = async (attempt = 0) => {
        try {
          await api.claimTx({ claimId: pendingClaimId, txHash: hash });
          pushLine('Transaction tracked by backend');
          setPendingClaimId(null);
        } catch (e) {
          if (cancelled) return;
          const backoff = Math.min(30_000, 1000 * Math.pow(2, attempt));
          setTimeout(() => submit(attempt + 1), backoff);
        }
      };
      
      submit();
      return () => { cancelled = true; };
    }, [hash, pendingClaimId]);
    
    // Update wallet when account changes
    useEffect(() => {
      if (isConnected && address) {
        setWallet(address);
      } else {
        setWallet(undefined);
      }
    }, [isConnected, address, setWallet]);
    
    // Hash display animation
    useEffect(() => {
      if (!mining || !job) {
        setCurrentDisplayHash(hexFrom(job?.nonce, 64));
        setVisualizerNibs([]);
        return;
      }
      
      let counter = 0;
      const updateHash = () => {
        const nonce = hexFrom(job?.nonce, 64).slice(2);
        const counterHex = counter.toString(16).padStart(8, '0');
        const combined = nonce + counterHex;
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
      
      const interval = setInterval(updateHash, 200);
      return () => clearInterval(interval);
    }, [mining, job]);
    
    // Progress text
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
      if (miningProgress > 0 || miningEta > 0) {
        const progressStr = `${Math.floor(miningProgress)}%`;
        const etaStr = miningEta > 0 ? `${Math.floor(miningEta)}s` : '--';
        setProgressText(`Progress: ${progressStr} | ETA: ${etaStr}`);
      } else {
        setProgressText('Mining...');
      }
    }, [job, mining, miningProgress, miningEta]);
    
    // =========================================================================
    // EVENT HANDLERS - All button/interaction handlers
    // =========================================================================
    
    const handleConnect = async () => {
      setConnectPressed(true);
      setTimeout(() => setConnectPressed(false), 150);
      
      if (!isConnected) {
        if (onOpenWalletModal) onOpenWalletModal();
      } else {
        if (sessionId) {
          api.close(sessionId).catch(console.error);
        }
        disconnectWallet();
        clear();
        pushLine('Disconnected');
      }
    };
    
    const handleInsertCartridge = () => {
      console.log('[handleInsertCartridge] Called', { isConnected, sessionId });
      if (isConnected && !sessionId) {
        console.log('[handleInsertCartridge] Opening cartridge modal');
        setShowCartridgeModalV2(true);
      } else if (!isConnected) {
        console.log('[handleInsertCartridge] Not connected');
        pushLine('Connect wallet first!');
      } else {
        console.log('[handleInsertCartridge] Already inserted');
        pushLine('Cartridge already inserted');
      }
    };
    
    const handleAlchemyCartridgeSelect = async (ownedCartridge: OwnedCartridge) => {
      if (!address) return;
      
      setShowAlchemyCartridges(false);
      console.log('[MineBoyDevice] Cartridge selected:', ownedCartridge);
      
      // If we have a callback, pass the cartridge to the parent (carousel mode)
      if (onCartridgeSelected) {
        onCartridgeSelected(ownedCartridge);
      }
    };
    
    const fetchLockInfo = async () => {
      if (!address || !cartridge) return;
      // Mock lock info for debug modal
      const sid = getOrCreateSessionId(parseInt(cartridge.tokenId));
      const mockLockInfo = {
        ownershipLock: {
          active: true,
          ttl: 3600,
          owner: address,
          expiresAt: Date.now() + 3600000
        },
        sessionLock: {
          active: true,
          ttl: 60,
          sessionId: sid,
          expiresAt: Date.now() + 60000
        },
        walletSessions: {
          active: 1,
          limit: 10
        }
      };
      setLockInfo(mockLockInfo);
    };
    
    const handleA = async () => {
      playButtonSound();
      
      if (status === 'mining' || status === 'claiming') {
        console.log('[A] Ignoring - already busy');
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
        let jobToUse = job;
        
        if (!job || !job.id || (job.expiresAt && Date.now() > job.expiresAt)) {
          try {
            pushLine('Requesting fresh mining job...');
            const freshJob = await api.getNextJob(sessionId);
            
            if (!freshJob) {
              pushLine('No job available (cadence gate)');
              pushLine('Wait a moment and try again');
              return;
            }
            
            setJob(freshJob);
            jobToUse = freshJob;
          } catch (error: any) {
            if (error.type === 'rate_limit') {
              storeStopMining();
              setMining(false);
              setStatus('idle');
              playFailSound();
              setMode('terminal');
              clear();
              pushLine('⚠️  RATE LIMIT EXCEEDED!');
              pushLine(' ');
              pushLine('Too many job requests detected');
              const waitSec = Math.ceil(error.waitMs / 1000);
              pushLine(`Cooldown: ${waitSec} seconds`);
              return;
            }
            pushLine('Failed to get fresh job');
            return;
          }
        }
        
        if (!jobToUse?.id || !jobToUse?.data || !jobToUse?.target) {
          pushLine('Invalid job - re-insert cartridge');
          return;
        }
        
        if (!wallet || !cartridge?.tokenId) {
          pushLine('Session error - re-insert cartridge');
          return;
        }
        
        setFoundResult(null);
        setFound(undefined);
        setStatus('mining');
        setMining(true);
        setMode('visual');
        miner.resetSession();
        miner.start(jobToUse, wallet, cartridge.tokenId);
        startMiningSound();
      } else {
        miner.stop();
        setMining(false);
        setStatus('idle');
        stopMiningSound();
        pushLine('Mining stopped');
      }
    };
    
    const handleClaim = async (hit: FoundResult) => {
      // Full claim implementation - shortened for space, includes all logic from page.tsx
      try {
        setStatus('claiming');
        pushLine('Submitting claim...');
        
        if (!sessionId || !job || !cartridge) {
          throw new Error('No active session, job, or cartridge');
        }
        
        const minerId = getMinerIdCached();
        const jobId = getJobId(job);
        assertString(sessionId, 'sessionId');
        assertString(jobId, 'jobId');
        assertString(address, 'address');
        
        // Refresh lock
        const sid = getOrCreateSessionId(parseInt(cartridge.tokenId));
        await apiHeartbeat({
          wallet: address as `0x${string}`,
          chainId: cartridge.chainId,
          contract: cartridge.contractAddress as `0x${string}`,
          tokenId: parseInt(cartridge.tokenId),
          sessionId: sid,
          minerId
        });
        pushLine('Lock refreshed for claim...');
        
        await new Promise(r => setTimeout(r, 120));
        
        const doClaim = () => api.claimV3({
          sessionId,
          jobId,
          preimage: hit.preimage,
          hash: to0x(hit.hash),
          steps: hit.attempts,
          hr: hit.hr,
          minerId,
        });
        
        let claimResponse: any;
        try {
          claimResponse = await doClaim();
        } catch (e: any) {
          if (e.status === 409) {
            pushLine('Retrying claim after reattach...');
            await apiHeartbeat({
              wallet: address as `0x${string}`,
              chainId: cartridge.chainId,
              contract: cartridge.contractAddress as `0x${string}`,
              tokenId: parseInt(cartridge.tokenId),
              sessionId: sid
            });
            await new Promise(r => setTimeout(r, 150));
            claimResponse = await doClaim();
          } else {
            throw e;
          }
        }
        
        pushLine('Claim verified by backend');
        
        if (claimResponse.claimId) {
          setPendingClaimId(claimResponse.claimId);
        }
        
        if (claimResponse.nextJob) {
          setJob(claimResponse.nextJob);
          pushLine(`New job issued`);
        }
        
        if (claimResponse.claimId && claimResponse.claim && claimResponse.signature) {
          pushLine('Preparing on-chain transaction...');
          pushLine('Opening wallet for transaction...');
          
          const isDelegated = !!localVaultAddress || !!claimResponse.claim.caller;
          const routerAddress = isDelegated 
            ? (process.env.NEXT_PUBLIC_ROUTER_V3_1_ADDRESS || process.env.NEXT_PUBLIC_ROUTER_ADDRESS)
            : process.env.NEXT_PUBLIC_ROUTER_ADDRESS;
          
          const claimData = isDelegated ? {
            cartridge: to0x(claimResponse.claim.cartridge),
            tokenId: BigInt(claimResponse.claim.tokenId),
            wallet: to0x(claimResponse.claim.wallet),
            caller: to0x(claimResponse.claim.caller || address),
            nonce: to0x(claimResponse.claim.nonce),
            tier: BigInt(claimResponse.claim.tier),
            tries: BigInt(claimResponse.claim.tries),
            elapsedMs: BigInt(claimResponse.claim.elapsedMs),
            hash: to0x(claimResponse.claim.hash),
            expiry: BigInt(claimResponse.claim.expiry)
          } : {
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
            abi: isDelegated ? RouterV3_1ABI : RouterV3ABI,
            functionName: 'claimV3',
            args: [claimData, to0x(claimResponse.signature)],
            value: BigInt('10000000000000000'),
          };
          
          let txHash: string | undefined;
          if (provider === 'glyph' && walletClient) {
            txHash = await walletClient.writeContract(contractConfig);
          } else if (provider === 'wc' && walletClient) {
            txHash = await walletClient.writeContract(contractConfig);
          } else {
            throw new Error('No wallet client available');
          }
          
          if (txHash && claimResponse.claimId) {
            await api.claimTx({ claimId: claimResponse.claimId, txHash });
            pushLine('Transaction tracked by backend');
          }
          
          pushLine('Transaction submitted');
          pushLine('Waiting for confirmation...');
          setStatus('claimed');
          pushLine('Claim successful!');
          
          if (claimResponse.multiplier && claimResponse.multiplier.multiplier > 1.0) {
            pushLine(' ');
            pushLine(`🚀 MULTIPLIER BONUS: ${claimResponse.multiplier.multiplier}x`);
          }
        } else {
          pushLine('Off-chain verification complete');
          setStatus('claimed');
        }
        
        pushLine('Press A to mine again');
        setFound(undefined);
        
        setTimeout(() => {
          setFoundResult(null);
          setStatus('idle');
        }, 3000);
        
      } catch (err: any) {
        console.error('[CLAIM] failed', err);
        
        const errorMsg = err.info?.error || err.message || '';
        const isTooFast = errorMsg.toLowerCase().includes('too fast');
        const isTooSlow = errorMsg.toLowerCase().includes('too slow') || errorMsg.toLowerCase().includes('cherry');
        
        if (isTooFast || isTooSlow) {
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
          } else {
            pushLine('🚨 SECURITY ALERT: SUSPICIOUS TIMING');
            pushLine(' ');
            pushLine('Work took too long to complete');
            pushLine('Possible hash cherry-picking detected');
          }
          pushLine(' ');
          pushLine('🛡️  Anti-bot protection active');
          pushLine('Press A to try again');
          playFailSound();
          return;
        }
        
        const isExpired = err.info?.error === 'Invalid or expired job' || err.message === 'Job expired - cannot claim';
        if (isExpired) {
          setMode('terminal');
          setFoundResult(null);
          setFound(undefined);
          setCurrentDisplayHash('0x000000000000000000000000000000000000000000000000000000000000000000');
          setStatus('idle');
          pushLine('⏰ AFK PENALTY!');
          pushLine('You missed your hash window!');
          pushLine('The job expired before you claimed.');
          playFailSound();
          return;
        }
        
        if (err.status === 404 || err.status === 409) {
          if (err.info?.code === 'session_conflict') {
            const ttlSec = err.info?.details?.ttlSec || 60;
            pushLine(`🔒 CARTRIDGE LOCKED`);
            pushLine(`Session conflict - wait ${ttlSec}s`);
          } else {
            pushLine(`Session conflict: ${err.info?.error || 'Unknown error'}`);
          }
          clear();
          setStatus('idle');
          miner.stop();
        } else {
          const errorCode = err.info?.code || err.info?.error || 'unknown';
          const errorMessage = err.info?.message || err.info?.details || err.message || 'Unknown error';
          pushLine(`Claim failed (${err.status}): ${errorCode}`);
          pushLine(errorMessage);
        }
      }
    };
    
    const handleB = () => {
      playButtonSound();
      if (status === 'found' && foundResult) {
        handleClaim(foundResult);
      } else if (lastFound) {
        setFoundResult(lastFound);
        setStatus('found');
        pushLine('Claim modal reopened');
      } else {
        pushLine('B: No hash to claim');
      }
    };
    
    const handleDpad = (direction: string) => {
      playButtonSound();
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
      if (!sessionId) return;
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
      window.location.reload();
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
      clear();
      setShowCartridgeModalV2(true);
      pushLine('Please re-insert cartridge');
    };
    
    // =========================================================================
    // KEYBOARD SHORTCUTS (only when active)
    // =========================================================================
    
    useEffect(() => {
      if (!isActive) return;
      
      const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        const isTyping = target && (
          target.tagName === 'INPUT' || 
          target.tagName === 'TEXTAREA' || 
          target.tagName === 'SELECT' ||
          target.isContentEditable
        );
        
        if (isTyping && e.key !== 'Escape') return;
        
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
    }, [isActive, mining, status]);
    
    // =========================================================================
    // HELPER FUNCTIONS
    // =========================================================================
    
    const formatHashForDisplay = (hash: string | null) => {
      if (!hash || hash === "idle") {
        return "0x000000000000000000000000...000000";
      }
      const cleanHash = hash.startsWith("0x") ? hash.slice(2) : hash;
      const prefix = cleanHash.slice(0, 24);
      const suffix = cleanHash.slice(-6);
      return `0x${prefix}...${suffix}`;
    };
    
    const short = (h?: string, n = 10) =>
      h ? `${h.slice(0, n)}…${h.slice(-n)}` : '';
    
    const hashLcdText = formatHashForDisplay(currentDisplayHash);
    const statusLcdText = cooldownTimer !== null ? `${cooldownTimer}s` :
                         !isConnected ? 'DISCONNECTED' : 
                         !sessionId ? 'DISCONNECTED' :
                         status === 'found' ? 'SUCCESS' :
                         status === 'claimed' ? 'READY' :
                         mining ? attempts.toLocaleString() : 'READY';
    const hashRateLcdText = `${hr.toLocaleString()} H/s`;
    
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
    
    // =========================================================================
    // RENDER - Complete UI
    // =========================================================================
    
    return (
      <div
        ref={ref}
        className={className}
        style={{
          position: 'relative',
          width: W,
          height: H,
          pointerEvents: isActive ? 'auto' : 'none',
          opacity: isActive ? 1 : 0.75,
          transform: isActive ? 'scale(1)' : 'scale(0.97)',
          transition: 'opacity 0.3s, transform 0.3s',
          background: '#000', // Black fill to hide stacked devices behind
          ...style,
        }}
        tabIndex={isActive ? 0 : -1}
        role="application"
        aria-label={`MineBoy ${color} - Cartridge ${cartridge?.tokenId || 'None'}`}
      >
        {/* Accessibility heading */}
        <h2 style={{ position: 'absolute', left: -10000, top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
          MineBoy {color.charAt(0).toUpperCase() + color.slice(1)} - {cartridge ? `Mining with Cartridge #${cartridge.tokenId}` : 'No Cartridge'}
        </h2>

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
            pickaxeId={cartridge?.tokenId || '0'}
            multiplier={npcBalance >= 10 ? 1.5 : npcBalance >= 1 ? 1.2 : 1.0}
            multiplierSource={npcBalance >= 1 ? `NPC` : "BASE"}
            seasonPoints={seasonPoints}
            width={390}
            messages={scrollingMessages}
            scrollSpeed={60}
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
          top: (sessionId) ? (ejectButtonPressed ? 246.25 : 210.25) : 246.25,
          left: 0,
          zIndex: 100,
          transition: 'top 150ms ease',
          opacity: (sessionId) ? 1 : 0.5,
        }}>
          <SideButton onClick={(sessionId) ? handleEjectButton : undefined} />
        </div>

        {/* Hash Found Overlay */}
        {status === 'found' && mode === 'visual' && foundResult && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(0,0,0,0.55)',
            zIndex: 20,
            pointerEvents: 'auto',
          }}>
            <div style={{
              minWidth: 260,
              maxWidth: 340,
              padding: 16,
              borderRadius: 12,
              background: 'linear-gradient(180deg, #1a3d24, #0f2216)',
              border: '2px solid #4a7d5f',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              color: '#c8ffc8',
              textAlign: 'center',
            }}>
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
          zIndex: 0,
        }}>
          <EnhancedShell width={W} height={CONTENT_HEIGHT} color={color} />
        </div>

        {/* CRT Screen */}
        <div style={{
          position: "absolute",
          top: HUD_HEIGHT + px(9, CONTENT_HEIGHT) + 10,
          left: px(7, W),
          width: 335,
          aspectRatio: "1 / 1",
          background: "#0b2f18", 
          borderRadius: 12, 
          border: "3px solid",
          borderTopColor: "#1a3d24",
          borderLeftColor: "#1a3d24",
          borderRightColor: "#4a7d5f",
          borderBottomColor: "#4a7d5f",
          boxShadow: "inset 0 3px 6px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.1)",
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
            {booting ? (
              <div>
                {bootDisplayLines.map((line, index) => (
                  <div key={index} style={{ marginBottom: 2 }}>
                    {line}
                  </div>
                ))}
              </div>
            ) : mode === 'terminal' ? (
              <div>
                {terminal.length === 0 ? (
                  <TerminalTypewriter lines={[
                    "Click Connect to Connect a Wallet",
                    "Click 'M' for Cartridge Mints", 
                    "Click 'I' for Info",
                    "Click 'L' for Leaderboard"
                  ]} />
                ) : (
                  <TerminalTypewriter lines={[
                    ...terminal.slice(-7),
                    ...(mining ? ['Press > to return to Visualisation'] : [])
                  ]} />
                )}
              </div>
            ) : (
              <Visualizer3x3 nibs={visualizerNibs.map(v => v.nib)} />
            )}
          </div>
        </div>

        {/* Hash LCD */}
        <div style={{
          position: "absolute", 
          top: px(56, H) - 25 + 20,
          left: px(7, W),
          width: 336,
          background: "#0f2c1b", 
          border: "2px solid",
          borderTopColor: "#1a4d2a",
          borderLeftColor: "#1a4d2a",
          borderRightColor: "#3a8a4d",
          borderBottomColor: "#3a8a4d",
          borderRadius: 6, 
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.1)",
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

        {/* Status LCD */}
        <div style={{
          position: "absolute", 
          top: px(61.5, H) - 25 + 20,
          left: px(7, W),
          width: 148,
          background: "#0f2c1b", 
          border: "2px solid",
          borderTopColor: "#1a4d2a",
          borderLeftColor: "#1a4d2a",
          borderRightColor: "#3a8a4d",
          borderBottomColor: "#3a8a4d",
          borderRadius: 6, 
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.1)",
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

        {/* HashRate LCD */}
        <div style={{
          position: "absolute", 
          top: px(61.5, H) - 25 + 20,
          left: 226,
          width: 137,
          background: "#0f2c1b", 
          border: "2px solid",
          borderTopColor: "#1a4d2a",
          borderLeftColor: "#1a4d2a",
          borderRightColor: "#3a8a4d",
          borderBottomColor: "#3a8a4d",
          borderRadius: 6, 
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.1)",
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

        {/* Progress LCD */}
        <div style={{
          position: "absolute", 
          top: px(86.5, H) - 25 + 8,
          left: 9, 
          width: 230, 
          height: 29,
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
            fontSize: 12,
            letterSpacing: 0.5, 
            fontFamily: "Menlo, monospace",
            whiteSpace: "nowrap", 
            overflow: "hidden", 
            textOverflow: "ellipsis"
          }}>
            {progressText}
          </div>
        </div>

        {/* WALLET Button */}
        <button
          onClick={() => { playButtonSound(); if (onOpenWalletModal) onOpenWalletModal(); }}
          style={{
            position: "absolute",
            bottom: 175,
            left: 280,
            width: 75,
            height: 27,
            borderRadius: 18,
            border: "2px solid",
            borderTopColor: "#c8a8ff",
            borderLeftColor: "#c8a8ff",
            borderRightColor: "#6a4a8a",
            borderBottomColor: "#6a4a8a",
            cursor: "pointer",
            background: "linear-gradient(145deg, #a08fd4, #7a5fb8)",
            boxShadow: "0 2px 2px rgba(0,0,0,0.5)",
            fontWeight: 900,
            fontSize: 10,
            letterSpacing: 0.5,
            color: "#ffffff",
            transition: "all 0.1s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          WALLET
        </button>

        {/* MENU Button */}
        <button
          onClick={() => { playButtonSound(); setShowDebugModal(true); }}
          style={{
            position: "absolute",
            bottom: 775,
            right: 199,
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
            transform: "translateY(0) scale(1)",
            transition: "all 0.1s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          MENU
        </button>

        {/* CONNECT Button */}
        <div style={{ position: "absolute", left: 17, bottom: 775 }}>
          <button
            onClick={() => { playButtonSound(); handleConnect(); }}
            onPointerDown={() => setConnectPressed(true)}
            onPointerUp={() => setConnectPressed(false)}
            onPointerLeave={() => setConnectPressed(false)}
            style={{
              width: 90,
              height: 27,
              borderRadius: 18, 
              border: "2px solid",
              borderTopColor: connectPressed ? "#1a1a1a" : "#8a8a8a",
              borderLeftColor: connectPressed ? "#1a1a1a" : "#8a8a8a",
              borderRightColor: connectPressed ? "#6a6a6a" : "#2a2a2a",
              borderBottomColor: connectPressed ? "#6a6a6a" : "#2a2a2a",
              cursor: "pointer",
              background: "linear-gradient(145deg, #4a4a4a, #1a1a1a)",
              boxShadow: connectPressed 
                ? "inset 0 2px 3px rgba(0,0,0,0.6)" 
                : "0 2px 2px rgba(0,0,0,0.5)",
              fontWeight: 900, 
              fontSize: 10,
              letterSpacing: 0.5, 
              color: "#ffffff",
              transform: connectPressed ? "translateY(2px) scale(1)" : "translateY(0) scale(1)",
              transition: "all 0.1s ease",
            }}
          >
            {!isConnected ? 'CONNECT' : 'DISCONNECT'}
          </button>
        </div>

        {/* D-pad */}
        <div style={{ position: "absolute", left: 86, bottom: 253.5 + 14 }}>
          <DpadButton direction="up" size={38} onPress={() => handleDpad('up')} />
        </div>
        <div style={{ position: "absolute", left: 86, bottom: 159.5 + 14 }}>
          <DpadButton direction="down" size={38} onPress={() => handleDpad('down')} />
        </div>
        <div style={{ position: "absolute", left: 39, bottom: 206.5 + 14 }}>
          <DpadButton direction="left" size={38} onPress={() => handleDpad('left')} />
        </div>
        <div style={{ position: "absolute", left: 133, bottom: 206.5 + 14 }}>
          <DpadButton direction="right" size={38} onPress={() => handleDpad('right')} />
        </div>

        {/* A & B buttons */}
        <div style={{ position: "absolute", right: 37.5, bottom: 200.5 + 20 }}>
          <ActionButton label="A" onPress={handleA} size={80} variant="primary" />
        </div>
        <div style={{ position: "absolute", right: 127.5, bottom: 150.5 + 20 }}>
          <ActionButton label="B" onPress={handleB} size={60} variant="secondary" />
        </div>

        {/* Fan */}
        <div style={{ position: "absolute", right: 19, bottom: 55, zIndex: 1 }}>
          <FanSandwich spinning={mining} size={110} color={color} />
        </div>

        {/* LEDs */}
        <div style={{ 
          position: "absolute", 
          top: 37.5 + 80,
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

        {/* LED Clone (bevel effect) */}
        <div style={{ 
          position: "absolute", 
          top: 38 + 80,
          right: 19.5, 
          display: "flex", 
          gap: 12 
        }}>
          {['PWR', 'NET', 'CRT', 'SHA', 'MNE'].map((label) => (
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
          ))}
        </div>

        {/* Cartridge Slot */}
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

        {/* Cartridge (uninserted) */}
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
            <div style={{
              color: "#fff",
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: 0.5,
              textShadow: "0 1px 2px rgba(0,0,0,0.8)",
            }}>
              CARTRIDGE
            </div>
            
            {/* Cartridge connector pins */}
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

        {/* Cartridge (inserted) */}
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
            zIndex: 0,
            boxShadow: "inset 0 -2px 4px rgba(0,0,0,0.4)",
          }} />
        )}

        {/* MineBoy™ Branding - Removed for carousel, will be re-added properly later */}

        {/* Claim Overlay */}
        {lastFound && <ClaimOverlay />}

        {/* Job Expired Modal */}
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

        {/* Eject Confirm Modal */}
        {showEjectConfirm && (
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
              border: '2px solid #ff6b6b',
              borderRadius: 8,
              padding: 20,
              textAlign: 'center',
              maxWidth: 300,
              color: '#fff',
            }}>
              <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
                Eject Cartridge?
              </div>
              <div style={{ marginBottom: 20, fontSize: 14 }}>
                This will close your session and reload the page.
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button
                  onClick={() => { playButtonSound(); confirmEjectCart(); }}
                  style={{
                    backgroundColor: '#ff6b6b',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  EJECT
                </button>
                <button
                  onClick={() => { playButtonSound(); setShowEjectConfirm(false); }}
                  style={{
                    backgroundColor: '#333',
                    color: '#fff',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Debug Modal */}
        {showDebugModal && (
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
            <div style={{
              backgroundColor: '#1a3d24',
              border: '3px solid #4a7d5f',
              borderRadius: '12px',
              padding: '20px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              fontFamily: 'Menlo, monospace',
              color: '#c8ffc8',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)'
            }}>
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
                >
                  ×
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <SoundSettings />
                <StatisticsSection />

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
                    <div><strong>Color:</strong> {color}</div>
                    <div><strong>Active:</strong> {isActive ? 'Yes' : 'No'}</div>
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
                  </div>
                </div>

                {cartridge && (
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
                      <div><strong>Token ID:</strong> {cartridge.tokenId}</div>
                      <div><strong>Contract:</strong> {cartridge.contractAddress.slice(0, 6)}...{cartridge.contractAddress.slice(-4)}</div>
                      <div><strong>Chain ID:</strong> {cartridge.chainId}</div>
                    </div>
                  </div>
                )}

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
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PaidMessageModal */}
        {showPaidMessageModal && (
          <PaidMessageModal
            isOpen={showPaidMessageModal}
            onClose={() => setShowPaidMessageModal(false)}
          />
        )}

        {/* MineStrategyModal */}
        {showMineStrategyModal && (
          <MineStrategyModal
            isOpen={showMineStrategyModal}
            onClose={() => setShowMineStrategyModal(false)}
          />
        )}

        {/* Cartridge Selection Modals */}
        <CartridgeModalV2
          isOpen={showCartridgeModalV2}
          onClose={() => setShowCartridgeModalV2(false)}
          onLoadCartridges={() => {
            setShowCartridgeModalV2(false);
            setShowAlchemyCartridges(true);
          }}
          vaultAddress={localVaultAddress}
          onVaultChange={setLocalVaultAddress}
          playButtonSound={playButtonSound}
        />

        <CartridgeSelectionModal
          isOpen={showAlchemyCartridges}
          onClose={() => setShowAlchemyCartridges(false)}
          onSelectCartridge={handleAlchemyCartridgeSelect}
          lockedCartridge={null}
          vaultAddress={localVaultAddress || undefined}
        />
      </div>
    );
  }
);

MineBoyDevice.displayName = 'MineBoyDevice';

export default MineBoyDevice;
