import { useEffect, useRef } from 'react';
import { useMinerStore } from '@/state/miner';

// Mining configuration
const TICK_MS = 60;           // Fast ticks for smooth animation
const TARGET_HR = 2400;       // Target hash rate (H/s)
const FOUND_EVERY_MS = 45000; // Average time to find hash (45s)
const EMA_ALPHA = 0.2;        // Hash rate smoothing factor

export function useMinerLoop() {
  const { mining, miningState, tick, setHashRate, pushLine, setFoundHash, setMiningState } = useMinerStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const smoothedHRRef = useRef(0);
  const lastUpdateRef = useRef<number>(Date.now());

  // Generate pseudo-random hash using crypto.getRandomValues
  const generateHash = (): string => {
    const array = new Uint8Array(32); // 32 bytes = 64 hex chars
    crypto.getRandomValues(array);
    return '0x' + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  useEffect(() => {
    if (mining) {
      lastUpdateRef.current = Date.now();
      
      // Main mining loop with batch processing
      intervalRef.current = setInterval(() => {
        // Guard: only continue if we're in mining state
        if (miningState !== 'mining') {
          return;
        }
        
        const now = Date.now();
        const deltaTime = (now - lastUpdateRef.current) / 1000;
        
        // Calculate batch size to hit target hash rate
        const batchSize = Math.max(1, Math.round((TARGET_HR * TICK_MS) / 1000));
        
        // Generate one hash for display, but simulate batchSize attempts
        const hash = generateHash();
        
        // Update attempts with batch size
        const state = useMinerStore.getState();
        const newAttempts = state.attempts + batchSize;
        useMinerStore.setState({ attempts: newAttempts, currentHash: hash });
        
        // Calculate and smooth hash rate
        if (deltaTime > 0) {
          const instantHR = batchSize / deltaTime;
          smoothedHRRef.current = smoothedHRRef.current === 0 
            ? instantHR 
            : smoothedHRRef.current * (1 - EMA_ALPHA) + instantHR * EMA_ALPHA;
          
          setHashRate(Math.round(smoothedHRRef.current));
        }
        
        // Check for found hash with proper probability
        const findProbability = 1 / (TARGET_HR * (FOUND_EVERY_MS / 1000));
        for (let i = 0; i < batchSize; i++) {
          if (Math.random() < findProbability) {
            // Found a hash - stop mining and set state
            setFoundHash(hash);
            setMiningState('found');
            useMinerStore.setState({ mining: false }); // Stop mining
            pushLine(`Found target hash! Press B to claim.`);
            return; // Exit the interval
          }
        }
        
        // Occasional telemetry line
        if (newAttempts % 5000 === 0 && newAttempts > 0) {
          pushLine(`A: ${newAttempts.toLocaleString()} | HR: ${Math.round(smoothedHRRef.current).toLocaleString()} H/s`);
        }
        
        lastUpdateRef.current = now;
      }, TICK_MS);
      
    } else {
      // Clear intervals when mining stops
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      smoothedHRRef.current = 0;
    }

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [mining, tick, setHashRate, pushLine, setFoundHash]);
}
