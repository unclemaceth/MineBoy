import type { MiningState } from '../../state/miner';

// Mining configuration
const miningTarget = {
  type: "suffix" as const,
  values: ["59517d556", "00000", "111111", "abc123"] // Multiple possible suffixes
};

const miningConfig = {
  TARGET_HR: 2400,        // Target hash rate (H/s)
  TICK_MS: 60,           // Mining tick interval
  FOUND_EVERY_MS: 45000, // Average time to find hash (45s)
  EMA_ALPHA: 0.2,        // Hash rate smoothing factor
};

function endsWithAny(hash: string, suffixes: string[]): string | null {
  const cleanHash = hash.replace('0x', '').toLowerCase();
  for (const suffix of suffixes) {
    if (cleanHash.endsWith(suffix.toLowerCase())) {
      return suffix;
    }
  }
  return null;
}

export class MockMiner {
  private state: MiningState = 'idle';
  private intervalRef: number | null = null;
  private smoothedHR = 0;
  private lastUpdate = Date.now();
  private onStateChange?: (state: MiningState) => void;
  private onHashUpdate?: (data: { hash: string; attempts: number; hashRate: number }) => void;
  private onFoundHash?: (hash: string, suffix: string) => void;
  private onTelemetry?: (message: string) => void;
  
  private attempts = 0;

  constructor(callbacks: {
    onStateChange?: (state: MiningState) => void;
    onHashUpdate?: (data: { hash: string; attempts: number; hashRate: number }) => void;
    onFoundHash?: (hash: string, suffix: string) => void;
    onTelemetry?: (message: string) => void;
  }) {
    this.onStateChange = callbacks.onStateChange;
    this.onHashUpdate = callbacks.onHashUpdate;
    this.onFoundHash = callbacks.onFoundHash;
    this.onTelemetry = callbacks.onTelemetry;
  }

  private generateHash(): string {
    const array = new Uint8Array(32); // 32 bytes = 64 hex chars
    crypto.getRandomValues(array);
    return '0x' + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  private setState(newState: MiningState) {
    if (this.state !== newState) {
      this.state = newState;
      this.onStateChange?.(newState);
    }
  }

  start() {
    if (this.state === 'mining') return;
    
    this.setState('mining');
    this.lastUpdate = Date.now();
    this.smoothedHR = 0;
    
    this.intervalRef = window.setInterval(() => {
      if (this.state !== 'mining') return;
      
      const now = Date.now();
      const deltaTime = (now - this.lastUpdate) / 1000;
      
      // Calculate batch size to hit target hash rate
      const batchSize = Math.max(1, Math.round((miningConfig.TARGET_HR * miningConfig.TICK_MS) / 1000));
      
      // Generate one hash for display, but simulate batchSize attempts
      const hash = this.generateHash();
      this.attempts += batchSize;
      
      // Calculate and smooth hash rate
      if (deltaTime > 0) {
        const instantHR = batchSize / deltaTime;
        this.smoothedHR = this.smoothedHR === 0 
          ? instantHR 
          : this.smoothedHR * (1 - miningConfig.EMA_ALPHA) + instantHR * miningConfig.EMA_ALPHA;
      }
      
      // Update hash and stats
      this.onHashUpdate?.({
        hash,
        attempts: this.attempts,
        hashRate: Math.round(this.smoothedHR)
      });
      
      // Check for target suffix
      const foundSuffix = endsWithAny(hash, miningTarget.values);
      if (foundSuffix) {
        this.setState('found');
        this.stop();
        this.onFoundHash?.(hash, foundSuffix);
        return;
      }
      
      // Occasional telemetry
      if (this.attempts % 5000 === 0 && this.attempts > 0) {
        this.onTelemetry?.(`A: ${this.attempts.toLocaleString()} | HR: ${Math.round(this.smoothedHR).toLocaleString()} H/s`);
      }
      
      this.lastUpdate = now;
    }, miningConfig.TICK_MS);
  }

  stop() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
    
    if (this.state === 'mining') {
      this.setState('idle');
    }
    
    this.smoothedHR = 0;
  }

  claim() {
    if (this.state === 'found') {
      this.setState('claiming');
      // Simulate claim process, then return to idle
      setTimeout(() => {
        this.setState('idle');
      }, 2000);
    }
  }

  dismiss() {
    if (this.state === 'found') {
      this.setState('idle');
    }
  }

  getState(): MiningState {
    return this.state;
  }

  getAttempts(): number {
    return this.attempts;
  }

  getHashRate(): number {
    return Math.round(this.smoothedHR);
  }

  reset() {
    this.stop();
    this.attempts = 0;
    this.smoothedHR = 0;
    this.setState('idle');
  }
}
