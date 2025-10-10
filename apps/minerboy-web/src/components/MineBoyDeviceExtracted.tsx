// MineBoyDeviceExtracted.tsx - CHECKPOINT 2: Full state & worker extraction
// This is a work-in-progress extraction - will rename to MineBoyDevice.tsx when complete
"use client";

import { useState, useEffect, useCallback, useRef, forwardRef } from "react";
import EnhancedShell from "@/components/art/EnhancedShell";
import HUD from "@/components/HUD";
import ActionButton from "@/components/ui/ActionButton";
import DpadButton from "@/components/ui/DpadButton";
import FanSandwich from "@/components/ui/FanSandwich";
import SideButton from "@/components/ui/SideButton";
import PaidMessageModal from "@/components/PaidMessageModal";
import MineStrategyModal from "@/components/MineStrategyModal";
import ClaimOverlay from "@/components/ClaimOverlay";
import NPCSimple from "@/components/art/NPCSimple";
import Visualizer3x3 from "@/components/Visualizer3x3";
import { useActiveAccount } from '@/hooks/useActiveAccount';
import { useActiveDisconnect } from '@/hooks/useActiveDisconnect';
import { useActiveWalletClient } from '@/hooks/useActiveWalletClient';
import { useSession, getOrCreateMinerId } from "@/state/useSession";
import { useMinerStore } from "@/state/miner";
import { useMinerWorker } from "@/hooks/useMinerWorker";
import { useTypewriter } from "@/hooks/useTypewriter";
import { useJobTtl } from "@/hooks/useJobTtl";
import { useNPCBalance } from "@/hooks/useNPCBalance";
import { api, apiGetIndividualLeaderboard } from "@/lib/api";
import { heartbeat } from "@/utils/HeartbeatController";
import { getOwnedCartridges, type OwnedCartridge } from '@/lib/alchemy';
import { getMinerIdCached } from "@/utils/minerId";
import { getJobId, assertString } from "@/utils/job";
import { getOrCreateSessionId } from '@/lib/miningSession';
import { apiStart, apiHeartbeat } from '@/lib/miningApi';
import { normalizeJob } from '@/lib/normalizeJob';
import { to0x, hexFrom } from "@/lib/hex";
import { playButtonSound, playConfirmSound, playFailSound, startMiningSound, stopMiningSound, soundManager } from '@/lib/sounds';
import { useWriteContract, useReadContract } from 'wagmi';
import type { MiningJob as Job } from "@/types/mining";
import RouterV3ABI from '@/abi/RouterV3.json';
import RouterV3_1ABI from '@/lib/RouterV3_1ABI.json';

export type MineBoyColor = 'blue' | 'orange' | 'green';

type FoundResult = {
  hash: string;
  preimage: string;
  attempts: number;
  hr: number;
};

// Terminal typewriter component
function TerminalTypewriter({ lines }: { lines: string[] }) {
  const { displayLines } = useTypewriter(lines, 15, 50);
  return (
    <div>
      {displayLines.map((line, index) => (
        <div key={index} style={{ 
          marginBottom: 2,
          opacity: index < 2 ? 0.6 : 1,
        }}>
          {line}
        </div>
      ))}
    </div>
  );
}

export interface MineBoyDeviceProps {
  // Core props
  cartridge: OwnedCartridge;
  color: MineBoyColor;
  isActive: boolean;
  
  // Callbacks
  onEject: () => void;
  
  // Shared services (from parent)
  playButtonSound?: () => void;
  vaultAddress?: string; // For delegation
  scrollingMessages?: Array<string | { text: string; color?: string; prefix?: string; type?: string }>;
  seasonPoints?: number;
  
  // Optional styling
  className?: string;
  style?: React.CSSProperties;
}

/**
 * MineBoyDevice - CHECKPOINT 2: Full state & worker extraction
 * 
 * ✅ Device-local state
 * ✅ Worker hooks & callbacks
 * ✅ Session management
 * ⏳ Event handlers (next)
 * ⏳ Full UI render (next)
 */
const MineBoyDeviceExtracted = forwardRef<HTMLDivElement, MineBoyDeviceProps>(
  ({ 
    cartridge, 
    color, 
    isActive, 
    onEject, 
    playButtonSound = () => {}, 
    vaultAddress = '',
    scrollingMessages = ["MineBoy™ it Mines stuff!"],
    seasonPoints = 0,
    className, 
    style 
  }, ref) => {
    
    // ==========================================================================
    // LAYOUT CONSTANTS
    // ==========================================================================
    const W = 390;
    const HUD_HEIGHT = 80;
    const CONTENT_HEIGHT = 844;
    const H = 924;
    const px = (p: number, total: number) => Math.round(total * p / 100);

    // ==========================================================================
    // DEVICE-LOCAL STATE (extracted from page.tsx)
    // ==========================================================================
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

    // ==========================================================================
    // WALLET & ACCOUNT (from parent context)
    // ==========================================================================
    const { address, isConnected, provider } = useActiveAccount();
    const { disconnectWallet } = useActiveDisconnect();
    const { data: walletClientData } = useActiveWalletClient();
    const { writeContract, writeContractAsync, data: hash } = useWriteContract();

    // Fetch NPC balance for multiplier display
    const { npcBalance } = useNPCBalance((vaultAddress || address) as `0x${string}` | undefined);

    // Read MNESTR token balance
    const { data: mnestrBalanceRaw } = useReadContract({
      address: '0xAe0DfbB1a2b22080F947D1C0234c415FabEEc276' as `0x${string}`,
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

    const mnestrBalance = mnestrBalanceRaw ? Number(mnestrBalanceRaw) / 1e18 : 0;

    // ==========================================================================
    // SESSION STATE (device-specific)
    // ==========================================================================
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

    // Miner store for boot sequence
    const { bootLines, stopMining: storeStopMining, setHashRate } = useMinerStore();

    // ==========================================================================
    // MINER WORKER (device-specific)
    // ==========================================================================
    const miner = useMinerWorker({
      onTick: (data) => {
        setTelemetry(data.attempts, data.hr);
        if (data.hash) {
          setCurrentDisplayHash(data.hash);
        }
        if (data.nibs && data.nibs.length === 9) {
          setVisualizerNibs(data.nibs);
        }
        if (data.progress !== undefined) {
          setMiningProgress(data.progress);
        }
        if (data.estimatedSecondsLeft !== undefined) {
          setMiningEta(data.estimatedSecondsLeft);
        }
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
        console.log('[MineBoyDevice][FOUND_FROZEN]', { color, tokenId: cartridge.tokenId, result: frozenResult });
      },
      onError: (message) => {
        pushLine(`Error: ${message}`);
        setMining(false);
        setStatus('error');
        stopMiningSound();
      },
      onStopped: async (reason) => {
        console.log('[MineBoyDevice][STOPPED]', { color, tokenId: cartridge.tokenId, reason });
        
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

    // ==========================================================================
    // LIFECYCLE: Worker cleanup on unmount
    // ==========================================================================
    useEffect(() => {
      return () => {
        console.log(`[MineBoyDevice] Unmounting ${color} cart ${cartridge.tokenId}, cleaning up worker`);
        miner.hardKill('unmount');
      };
    }, [cartridge.tokenId, color, miner]);

    // ==========================================================================
    // SESSION LOGGING (Dev mode)
    // ==========================================================================
    useEffect(() => {
      if (process.env.NODE_ENV === 'development' && sessionId) {
        console.log(`[MineBoyDevice][${color}] Session state:`, {
          sessionId: sessionId.slice(0, 8) + '...',
          tokenId: cartridge.tokenId,
          minerId: getMinerIdCached().slice(0, 8) + '...',
          isActive,
          mining,
          hr,
          attempts,
        });
      }
    }, [sessionId, cartridge.tokenId, color, isActive, mining, hr, attempts]);

    // ==========================================================================
    // BOOT SEQUENCE
    // ==========================================================================
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

    // ==========================================================================
    // TODO: Add remaining effects and handlers
    // - Heartbeat
    // - Cooldown timer
    // - Mine blink effect
    // - Transaction hash watcher
    // - Event handlers (handleConnect, handleA, handleB, etc.)
    // - Full UI render
    // ==========================================================================

    // ==========================================================================
    // PLACEHOLDER RENDER (will be replaced with full UI)
    // ==========================================================================
    
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
          ...style,
        }}
        tabIndex={isActive ? 0 : -1}
        role="application"
        aria-label={`MineBoy ${color} - Cartridge ${cartridge.tokenId}`}
      >
        {/* Accessibility heading */}
        <h2 style={{ position: 'absolute', left: -10000, top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
          MineBoy {color.charAt(0).toUpperCase() + color.slice(1)} - Mining with Cartridge #{cartridge.tokenId}
        </h2>

        {/* Shell background */}
        <div style={{
          position: "absolute",
          top: HUD_HEIGHT,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 28,
          overflow: "hidden",
        }}>
          <EnhancedShell width={W} height={CONTENT_HEIGHT} color={color} />
        </div>

        {/* Placeholder content */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64ff8a',
          fontFamily: 'Menlo, monospace',
          fontSize: 14,
          gap: 12,
          zIndex: 10,
        }}>
          <div>MineBoy Device ({color})</div>
          <div>Cartridge #{cartridge.tokenId}</div>
          <div>Status: {isActive ? 'ACTIVE' : 'BACKGROUND'} | {status}</div>
          <div>Mining: {mining ? 'YES' : 'NO'}</div>
          <div>HR: {hr} H/s | Attempts: {attempts}</div>
          <div>Session: {sessionId ? sessionId.slice(0, 8) + '...' : 'NONE'}</div>
          <button 
            onClick={onEject}
            style={{
              padding: '8px 16px',
              background: '#ff6b6b',
              border: 'none',
              borderRadius: 4,
              color: 'white',
              cursor: 'pointer',
            }}
          >
            Eject
          </button>
        </div>
      </div>
    );
  }
);

MineBoyDeviceExtracted.displayName = 'MineBoyDeviceExtracted';

export default MineBoyDeviceExtracted;

