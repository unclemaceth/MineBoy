"use client";
import { useState, useEffect } from "react";
import dynamic from 'next/dynamic';
import Stage from "@/components/Stage";
import ActionButton from "@/components/ui/ActionButton";
import DpadButton from "@/components/ui/DpadButton";
import FanSandwich from "@/components/ui/FanSandwich";
import EnhancedShell from "@/components/art/EnhancedShell";
import ClaimOverlay from "@/components/ClaimOverlay";
import NPCSimple from "@/components/art/NPCSimple";
import Visualizer3x3 from "@/components/Visualizer3x3";
import WalletConnectionModal from "@/components/WalletConnectionModal";
import { useAccount, useDisconnect, useWriteContract } from 'wagmi';
import { useSession, getOrCreateMinerId } from "@/state/useSession";
import { useMinerStore } from "@/state/miner";
import { useMinerWorker } from "@/hooks/useMinerWorker";
import { useTypewriter } from "@/hooks/useTypewriter";
import { api } from "@/lib/api";
import type { CartridgeConfig } from '../../../../packages/shared/src/mining';

const W = 390; // iPhone 13 CSS pixels
const H = 844; // iPhone 13 CSS pixels
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
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [pendingClaimId, setPendingClaimId] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [mineBlink, setMineBlink] = useState(false);
  const [status, setStatus] = useState<'idle'|'mining'|'found'|'claiming'|'claimed'|'error'>('idle');
  const [foundResult, setFoundResult] = useState<FoundResult | null>(null);
  
  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { writeContract, data: hash } = useWriteContract();
  
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
  const { bootLines } = useMinerStore();
  
  // Miner worker
  const miner = useMinerWorker({
    onTick: (a, hashRate) => setTelemetry(a, hashRate),
    onFound: ({ hash, preimage, attempts, hr }) => {
      // Check if job is still valid before processing found hash
      if (job && job.expiresAt && Date.now() > job.expiresAt) {
        console.log('[FOUND_EXPIRED] Job expired, ignoring found hash');
        pushLine('Hash found but job expired - ignoring');
        return;
      }
      
      setMining(false);
      setStatus('found');
      // Freeze the exact FOUND payload - never recompute
      const frozenResult = { hash, preimage, attempts, hr };
      setFoundResult(frozenResult);
      setFound({ hash: hash as `0x${string}`, preimage, attempts, hr });
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
  
  // Update wallet when account changes
  useEffect(() => {
    if (isConnected && address) {
      setWallet(address);
      pushLine('Connected to Curtis Network');
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
  
  // Mine blink effect
  useEffect(() => {
    if (!mining) { 
      setMineBlink(false); 
      return; 
    }
    const id = setInterval(() => setMineBlink(b => !b), 400);
    return () => clearInterval(id);
  }, [mining]);
  
  // Job expiry check
  useEffect(() => {
    if (!job || !mining) return;
    
    const checkExpiry = async () => {
      if (job.expiresAt && Date.now() > job.expiresAt) {
        miner.stop();
        setMining(false);
        setStatus('idle');
        setFoundResult(null); // Clear any pending found result
        setFound(undefined); // Clear lastFound from session
        pushLine('Job expired - stopping mining');
        
        // Show job expired popup
        setShowJobExpired(true);
        
        hapticFeedback();
      }
    };
    
    const interval = setInterval(checkExpiry, 1000); // Check every second
    return () => clearInterval(interval);
  }, [job, mining, pushLine, sessionId]);

  // Heartbeat to refresh lock while mining
  useEffect(() => {
    if (!mining || !sessionId) return;
    
    const heartbeat = async () => {
      try {
        await api.heartbeat(sessionId, getOrCreateMinerId());
      } catch (error: unknown) {
        console.warn('Heartbeat failed:', error);
        
        // If session not found (404), clear session and stop mining
        if ((error instanceof Error && error.message?.includes('404')) || (error instanceof Error && error.message?.includes('Session not found'))) {
          console.log('Session expired - clearing state and stopping mining');
          pushLine('Session expired - please reconnect');
          
          // Stop mining immediately
          miner.stop();
          
          // Clear session state
          clear();
          setStatus('idle');
        }
      }
    };
    
    const interval = setInterval(heartbeat, 10000); // Every 10 seconds
    return () => clearInterval(interval);
  }, [mining, sessionId]);

  // Watch for transaction hash and report to backend
  useEffect(() => {
    if (hash && pendingClaimId) {
      // Report transaction hash to backend for tracking
      api.claimTx({ claimId: pendingClaimId, txHash: hash })
        .then(() => {
          pushLine('Transaction tracked by backend');
          setPendingClaimId(null); // Clear after successful report
        })
        .catch((error) => {
          console.warn('Failed to report tx hash to backend:', error);
          // Don't fail the claim if this fails
        });
    }
  }, [hash, pendingClaimId, pushLine]);
  
  // Haptic feedback helper
  const hapticFeedback = () => {
    try {
      navigator.vibrate?.(15);
    } catch {
      // Ignore vibration errors
    }
  };
  
  // Button handlers
  const handleConnect = async () => {
    hapticFeedback();
    setConnectPressed(true);
    setTimeout(() => setConnectPressed(false), 150);

    if (!isConnected) {
      setShowWalletModal(true);
    } else {
      disconnect();
      clear();
      pushLine('Disconnected');
    }
  };
  
  const handleInsertCartridge = () => {
    hapticFeedback();
    if (isConnected && !sessionId) {
      setShowCartridgeSelect(true);
    } else if (!isConnected) {
      pushLine('Connect wallet first!');
    } else {
      pushLine('Cartridge already inserted');
    }
  };
  
  const handleCartridgeSelect = async (cartridgeInfo: CartridgeConfig, tokenId: string) => {
    if (!address) return;
    
    setShowCartridgeSelect(false);
    pushLine(`Opening session with ${cartridgeInfo.name}...`);
    
    try {
      const res = await api.openSession({
        wallet: address,
        cartridge: {
          chainId: cartridgeInfo.chainId,
          contract: cartridgeInfo.contract,
          tokenId
        },
        clientInfo: { ua: navigator.userAgent },
        minerId: getOrCreateMinerId()
      });
      
      loadOpenSession(res, address, { info: cartridgeInfo, tokenId });
      pushLine('Session opened successfully!');
      
    } catch (error) {
      pushLine(`Session failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  const handleA = async () => {
    hapticFeedback();
    
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
    
    if (!sessionId || !job) {
      pushLine('Insert cartridge first!');
      return;
    }
    
    if (!mining) {
      // Check if job is still valid
      if (job && job.expiresAt && Date.now() > job.expiresAt) {
        pushLine('Job expired - requesting new job...');
        try {
          const newJob = await api.getNextJob(sessionId);
          setJob(newJob);
          pushLine('New job received - starting mining');
          // Start mining with new job
          setFoundResult(null);
          setFound(undefined); // Clear lastFound from session
          setStatus('mining');
          setMining(true);
          setMode('visual');
          miner.start(newJob);
          pushLine('Mining started...');
        } catch {
          pushLine('Failed to get new job - re-insert cartridge');
        }
        return;
      }
      
      // Start mining
      console.log('Starting mining with job:', job);
      setFoundResult(null);
      setFound(undefined); // Clear lastFound from session
      setStatus('mining');
      setMining(true);
      setMode('visual'); // Auto-switch to visualizer
      miner.start(job);
      pushLine('Mining started...');
    } else {
      // Stop mining
      console.log('Stopping mining');
      miner.stop();
      setMining(false);
      setStatus('idle');
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

      // Check if job is still valid
      if (job.expiresAt && Date.now() > job.expiresAt) {
        throw new Error('Job expired - cannot claim');
      }

      // Pre-claim heartbeat check to ensure session is still alive
      try {
        await api.heartbeat(sessionId, getOrCreateMinerId());
        pushLine('Session verified - proceeding with claim...');
      } catch (error: unknown) {
        if ((error instanceof Error && error.message?.includes('404')) || (error instanceof Error && error.message?.includes('Session not found'))) {
          throw new Error('Session expired - please reconnect and try again');
        }
        throw error; // Re-throw other errors
      }

      // Send the frozen payload exactly as received from worker
      console.log('[CLAIM_BODY]', hit, { sessionId, jobId: job.jobId || job.id });
      
      const claimResponse = await api.claim({
        sessionId,
        jobId: job.jobId || job.id,
        preimage: hit.preimage,  // exact string from worker
        hash: hit.hash,          // exact hash from worker
        steps: hit.attempts,
        hr: hit.hr,
        minerId: getOrCreateMinerId()
      });

      console.log('[CLAIM_OK]', claimResponse);
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
      if (claimResponse.claimId) {
        pushLine('Preparing on-chain transaction...');
        if (claimResponse.txHash) {
          pushLine(`Transaction: ${claimResponse.txHash.slice(0, 8)}...${claimResponse.txHash.slice(-6)}`);
        }
        
        try {
          // Submit claim to smart contract
          pushLine('Opening wallet for transaction...');
          
          // Use the proper MiningClaimRouter contract
          const routerAddress = '0x34a227cf6c6a2f5f4f7c7710e8416555334e01bf';
          
          writeContract({
            address: routerAddress as `0x${string}`,
            abi: [
              {
                name: 'claim',
                type: 'function',
                stateMutability: 'nonpayable',
                inputs: [
                  { name: 'claimData', type: 'tuple', components: [
                    { name: 'wallet', type: 'address' },
                    { name: 'cartridge', type: 'address' },
                    { name: 'tokenId', type: 'uint256' },
                    { name: 'rewardToken', type: 'address' },
                    { name: 'rewardAmount', type: 'uint256' },
                    { name: 'workHash', type: 'bytes32' },
                    { name: 'attempts', type: 'uint64' },
                    { name: 'nonce', type: 'bytes32' },
                    { name: 'expiry', type: 'uint64' }
                  ]},
                  { name: 'signature', type: 'bytes' }
                ],
                outputs: []
              }
            ],
            functionName: 'claim',
            args: [claimResponse.claimId, claimResponse.txHash || '0x'],
          });
          
          pushLine('Transaction submitted - waiting for hash...');
          pushLine('Waiting for confirmation...');
          
          // Note: Transaction confirmation would be handled by wagmi hooks
          setStatus('claimed');
          pushLine('Claim successful!');
          
          
        } catch (txError: unknown) {
          console.error('[TX_ERROR]', txError);
          pushLine(`Transaction failed: ${txError instanceof Error ? txError.message : String(txError)}`);
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
      
    } catch (err: unknown) {
      console.error('[CLAIM] failed', err);
      
      // Handle session expiration specifically
      if ((err instanceof Error && err.message?.includes('Session expired')) || (err instanceof Error && err.message?.includes('404')) || (err instanceof Error && err.message?.includes('Session not found'))) {
        pushLine('Session expired - please reconnect');
        
        // Clear session state
        clear();
        setStatus('idle');
        
        // Stop any running worker
        miner.stop();
      } else {
        pushLine(`Claim failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setStatus('error');
      }
    }
  };

  const handleGetNewJob = async () => {
    if (!sessionId) return;
    
    try {
      setShowJobExpired(false);
      pushLine('Requesting new job...');
      const newJob = await api.getNextJob(sessionId);
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
    hapticFeedback();
    
    if (status === 'found' && foundResult) {
      handleClaim(foundResult);
    } else if (lastFound) {
      // Reopen claim modal for found hash
      setFoundResult(lastFound);
      setStatus('found');
      pushLine('Claim modal reopened - press Claim to submit or B to dismiss');
    } else {
      // Toggle view
      setMode(mode === 'visual' ? 'terminal' : 'visual');
      pushLine(`Switched to ${mode === 'visual' ? 'terminal' : 'visual'} view`);
    }
  };
  
  const handleDpad = (direction: string) => {
    hapticFeedback();
    
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
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
            hapticFeedback();
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
  
  // Update hash display when mining
  useEffect(() => {
    if (!mining || !job) {
      setCurrentDisplayHash(job?.nonce || '0x0000000000000000000000000000000000000000000000000000000000000000');
      return;
    }

    let counter = 0;
    
    const updateHash = () => {
      // Generate a realistic-looking hash based on job nonce + counter
      const nonce = job.nonce ? job.nonce.slice(2) : '0'; // Remove 0x
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
  const statusLcdText = !isConnected ? 'DISCONNECTED' : 
                       !sessionId ? 'DISCONNECTED' :
                       mining ? attempts.toLocaleString() : 'READY';
  const hashRateLcdText = `${hr.toLocaleString()} H/s`;
  
  // Difficulty info with live TTL countdown
  const [difficultyText, setDifficultyText] = useState('No job');
  
  useEffect(() => {
    if (!job) {
      setDifficultyText('No job');
      return;
    }

    const updateDifficulty = () => {
      const rule = job.rule || 'suffix';
      const suffix = job.suffix || '??';
      const bits = job.bits || job.difficultyBits || '??';
      
      // Determine difficulty level
      let difficultyLevel = 'EASY';
      if (rule === 'suffix') {
        if (suffix.length >= 8) difficultyLevel = 'HARD';
        else if (suffix.length >= 7) difficultyLevel = 'MED';
        else if (suffix.length >= 6) difficultyLevel = 'EASY';
        else if (suffix.length >= 4) difficultyLevel = 'EASY';
        else difficultyLevel = 'EASY';
      } else {
        const bitCount = typeof bits === 'number' ? bits : parseInt(bits.toString());
        if (bitCount >= 32) difficultyLevel = 'HARD';
        else if (bitCount >= 28) difficultyLevel = 'MED';
        else if (bitCount >= 24) difficultyLevel = 'EASY';
        else if (bitCount >= 16) difficultyLevel = 'EASY';
        else difficultyLevel = 'EASY';
      }
      
      const expiresIn = job.expiresAt ? Math.max(0, Math.floor((job.expiresAt - Date.now()) / 1000)) : 0;
      setDifficultyText(`D: ${difficultyLevel} | T: ${expiresIn}s`);
    };

    // Update immediately and then every second
    updateDifficulty();
    const interval = setInterval(updateDifficulty, 1000);
    
    return () => clearInterval(interval);
  }, [job]);

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
    <Stage>
      {/* Navigation Links */}
      <div style={{
        position: 'absolute',
        top: 809,
        right: 280,
        zIndex: 100,
        display: 'flex',
        gap: '8px'
      }}>
            <a 
              href="/mint" 
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
                color: '#c8ffc8',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 'bold',
                border: '2px solid #8a8a8a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                transition: 'all 0.1s ease'
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
            </a>
            <a 
              href="/instructions" 
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
                color: '#c8ffc8',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 'bold',
                border: '2px solid #8a8a8a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                transition: 'all 0.1s ease'
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
            </a>
            <a 
              href="/leaderboard" 
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'linear-gradient(145deg, #4a7d5f, #1a3d24)',
                color: '#c8ffc8',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 'bold',
                border: '2px solid #8a8a8a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                transition: 'all 0.1s ease'
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
            </a>
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
              <button onClick={() => handleClaim(foundResult)} style={btnGreen}>Claim</button>
              <button onClick={() => setStatus('idle')} style={btnGray}>Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Shell Background */}
      <div style={{
        position: "absolute",
        inset: 0,
        borderRadius: 28,
        overflow: "hidden",
      }}>
        <EnhancedShell width={W} height={H} />
      </div>

      {/* CRT (square): top 9%, left/right 7% => width 335px */}
      <div style={{
        position: "absolute",
        top: px(9, H) + 10, // 86px (moved down 10px)
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
            <Visualizer3x3 />
          )}
          
          {/* Live telemetry when mining (only show in terminal mode) */}
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
        </div>
      </div>

      {/* Hash LCD: top 56%, left 7%, width 336px */}
      <div style={{
        position: "absolute", 
        top: px(56, H) - 25, // 448px (moved up 25px total)
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
        top: px(61.5, H) - 25, // 484px (moved up 25px total)
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
        top: px(61.5, H) - 25, // 484px (moved up 25px total)
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

      {/* Debug Button: small button in top right */}
      <button
        onClick={() => setShowDebugModal(true)}
        style={{
          position: "absolute",
          top: px(7.8, H) - 25,
          right: px(54.5, W),
          width: 40,
          height: 30,
          background: "linear-gradient(145deg, #4a7d5f, #1a3d24)",
          border: "2px solid #8a8a8a",
          borderRadius: 6,
          color: "#c8ffc8",
          fontSize: 10,
          fontWeight: "bold",
          fontFamily: "Menlo, monospace",
          cursor: "pointer",
          boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.background = "linear-gradient(145deg, #1a3d24, #4a7d5f)";
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.background = "linear-gradient(145deg, #4a7d5f, #1a3d24)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "linear-gradient(145deg, #4a7d5f, #1a3d24)";
        }}
      >
        DEBUG
      </button>

      {/* Difficulty LCD: top 66%, left 7%, width 200px */}
      <div style={{
        position: "absolute", 
        top: px(86.5, H) - 25, 
        left: 9, 
        width: 230, 
        background: "#0f2c1b", 
        border: "2px solid",
        borderTopColor: "#1a4d2a", 
        borderLeftColor: "#1a4d2a", 
        borderRightColor: "#3a8a4d", 
        borderBottomColor: "#3a8a4d", 
        borderRadius: 6, 
        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.1)", 
        padding: "4px 8px"
      }}>
        <div style={{
          color: "#64ff8a", 
          fontSize: 10, 
          letterSpacing: 0.5, 
          fontFamily: "Menlo, monospace",
          whiteSpace: "nowrap", 
          overflow: "hidden", 
          textOverflow: "ellipsis"
        }}>
          {difficultyText}
        </div>
      </div>

      {/* CONNECT pill: 46px from bottom, left 37px */}
      <div style={{ position: "absolute", left: 37, bottom: 775 }}>
        <button
          onClick={handleConnect}
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



      {/* D-pad Up: moved 25px right, 50px down */}
      <div style={{ position: "absolute", left: 92, bottom: 253.5 }}>
        <DpadButton direction="up" size={38} onPress={() => handleDpad('up')} />
      </div>
      
      {/* D-pad Down: moved 25px right, 50px down */}
      <div style={{ position: "absolute", left: 92, bottom: 159.5 }}>
        <DpadButton direction="down" size={38} onPress={() => handleDpad('down')} />
      </div>
      
      {/* D-pad Left: moved 25px right, 50px down */}
      <div style={{ position: "absolute", left: 45, bottom: 206.5 }}>
        <DpadButton direction="left" size={38} onPress={() => handleDpad('left')} />
      </div>
      
      {/* D-pad Right: moved 25px right, 50px down */}
      <div style={{ position: "absolute", left: 139, bottom: 206.5 }}>
        <DpadButton direction="right" size={38} onPress={() => handleDpad('right')} />
      </div>

      {/* A button: moved up 7.5px, left 2.5px */}
      <div style={{ position: "absolute", right: 37.5, bottom: 200.5 }}>
        <ActionButton label="A" onPress={handleA} size={80} variant="primary" />
      </div>

      {/* B button: moved up 7.5px, left 2.5px */}
      <div style={{ position: "absolute", right: 127.5, bottom: 150.5 }}>
        <ActionButton label="B" onPress={handleB} size={60} variant="secondary" />
      </div>

      {/* Fan: right 60px, bottom 60px */}
      <div style={{ position: "absolute", right: 19, bottom: 55 }}>
        <FanSandwich spinning={mining} size={110} />
      </div>

      {/* LEDs: top-right row */}
      <div style={{ 
        position: "absolute", 
        top: 37.5, 
        right: 20, 
        display: "flex", 
        gap: 12 
      }}>
        {(() => {
          const hashFound = status === 'found' || !!foundResult || !!lastFound;
          const leds = [
            { label: 'PWR',  on: true },
            { label: 'NET',  on: isConnected },
            { label: 'CART', on: !!sessionId },
            { label: 'HASH', on: hashFound },
            { label: 'MINE', on: mining && mineBlink },
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
                color: "#6ccf85", 
                fontSize: 9, 
                marginTop: 2
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
            border: '2px solid #64ff8a',
            borderRadius: 8,
            padding: 20,
            maxWidth: 300,
            width: '90%',
          }}>
            <h3 style={{ color: '#64ff8a', marginBottom: 16, textAlign: 'center' }}>
              Select Cartridge
            </h3>
            {cartridges.map((cart) => (
              <div key={cart.contract} style={{ marginBottom: 12 }}>
                <div style={{ color: '#fff', marginBottom: 4 }}>{cart.name}</div>
                <input
                  type="text"
                  placeholder="Token ID"
                  id={`tokenId-${cart.contract}`}
                  style={{
                    width: '100%',
                    padding: 8,
                    backgroundColor: '#333',
                    border: '1px solid #555',
                    borderRadius: 4,
                    color: '#fff',
                    marginBottom: 8,
                    fontFamily: 'Menlo, monospace',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const tokenId = (e.target as HTMLInputElement).value;
                      if (tokenId) {
                        handleCartridgeSelect(cart, tokenId);
                      }
                    }
                  }}
                />
                
                {/* Number Input Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 8 }}>
                  {[1,2,3,4,5,6,7,8,9].map(num => (
                    <button
                      key={num}
                      onClick={() => {
                        const input = document.getElementById(`tokenId-${cart.contract}`) as HTMLInputElement;
                        if (input) {
                          input.value = num.toString();
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
                
                <button
                  onClick={() => {
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
                  }}
                >
                  Select
                </button>
              </div>
            ))}
            
            
            <button
              onClick={() => setShowCartridgeSelect(false)}
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
          onClick={handleInsertCartridge}
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
                onClick={handleGetNewJob}
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
                onClick={handleReinsertCartridge}
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
                onClick={() => setShowDebugModal(false)}
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
                <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#4a7d5f' }}>
                  JOB INFO
                </div>
                <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
                  {job ? (
                    <>
                      <div><strong>Job ID:</strong> {(job.jobId || job.id).slice(0, 8)}...{(job.jobId || job.id).slice(-6)}</div>
                      <div><strong>Nonce:</strong> {job.nonce ? `${job.nonce.slice(0, 8)}...${job.nonce.slice(-6)}` : 'N/A'}</div>
                      <div><strong>Difficulty:</strong> {job.suffix}</div>
                      <div><strong>Expires:</strong> {job.expiresAt ? new Date(job.expiresAt).toLocaleTimeString() : 'N/A'}</div>
                      <div><strong>TTL:</strong> {job.expiresAt ? Math.max(0, Math.floor((job.expiresAt - Date.now()) / 1000)) : 0}s</div>
                    </>
                  ) : (
                    <div>No active job</div>
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
            </div>

            {/* Footer */}
            <div style={{
              marginTop: '20px',
              paddingTop: '10px',
              borderTop: '2px solid #4a7d5f',
              textAlign: 'center'
            }}>
              <button
                onClick={() => setShowDebugModal(false)}
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

      {/* Wallet Connection Modal */}
      <WalletConnectionModal 
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
      />
    </Stage>
  );
}

export default dynamic(() => Promise.resolve(Home), { ssr: false });
