import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MiningJob as Job } from '@/types/mining';
import type { CartridgeConfig } from '@/lib/api';
import type { PickaxeMetadata } from '@/lib/alchemy';

// Generate or retrieve stable minerId
export function getOrCreateMinerId(): string {
  const key = 'minerId';
  let id = localStorage.getItem(key);
  if (!id) {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    id = 'mb_' + Array.from(buf).map(b => b.toString(16).padStart(2,'0')).join('');
    localStorage.setItem(key, id);
  }
  return id;
}

type FoundPayload = { 
  hash: `0x${string}`; 
  preimage: string; 
  attempts: number; 
  hr: number;
  // Tier information (added by backend)
  tier?: number;
  tierName?: string;
  amountLabel?: string;
};

type ClaimState = 'idle' | 'ready' | 'overlay' | 'submitting' | 'success' | 'error';

type SessionState = {
  // Connection state
  wallet?: `0x${string}`;
  cartridge?: { info: CartridgeConfig; tokenId: string; metadata?: PickaxeMetadata };
  sessionId?: string;
  job?: Job;
  
  // Mining state
  mining: boolean;
  attempts: number;
  hr: number;
  lastFound?: FoundPayload;
  claimState: ClaimState;
  
  // Terminal state (keep for UI compatibility)
  terminal: string[];
  mode: 'terminal' | 'visual';
  
  // Actions
  setWallet(addr?: `0x${string}`): void;
  setMining(on: boolean): void;
  setTelemetry(a: number, hr: number): void;
  setFound(p: FoundPayload | undefined): void;
  setClaimState(state: ClaimState): void;
  pushLine(line: string): void;
  setMode(mode: 'terminal' | 'visual'): void;
  setJob(job: Job): void;
  
  loadOpenSession(res: { sessionId: string; job?: Job }, wallet: `0x${string}`, cartridge: { info: CartridgeConfig; tokenId: string; metadata?: PickaxeMetadata }): void;
  clear(): void;
};

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      // Initial state
      mining: false,
      attempts: 0,
      hr: 0,
      claimState: 'idle',
      terminal: [],
      mode: 'terminal',
      
      // Actions
      setWallet: (wallet) => set({ wallet }),
      setMining: (mining) => set({ mining }),
      setTelemetry: (attempts, hr) => set({ attempts, hr }),
      setFound: (p) => set({ lastFound: p, claimState: p ? 'ready' : 'idle' }),
      setClaimState: (claimState) => set({ claimState }),
      setJob: (job) => set({ job }),
      
      pushLine: (line: string) => {
        set((state) => ({
          terminal: [...state.terminal.slice(-20), line] // Keep last 20 lines
        }));
      },
      
      setMode: (mode) => set({ mode }),
      
              loadOpenSession: (res, wallet, cartridge) => {
                set({ 
                  wallet, 
                  cartridge, 
                  sessionId: res.sessionId, 
                  job: res.job, 
                  attempts: 0, 
                  hr: 0, 
                  lastFound: undefined,
                  mode: 'terminal' // Start in terminal mode
                });
                
                // Add cartridge loading messages
                get().pushLine(`${cartridge.info.name} Loaded`);
                get().pushLine('Enabling Mining Protocol...');
                if (res.job) {
                  get().pushLine('Press A to Mine...');
                } else {
                  get().pushLine('No job available - try again');
                }
              },
      
      clear: () => set({
        wallet: undefined, 
        cartridge: undefined, 
        sessionId: undefined, 
        job: undefined,
        mining: false, 
        attempts: 0, 
        hr: 0, 
        lastFound: undefined,
        claimState: 'idle',
        terminal: [],
        mode: 'terminal'
      }),
    }),
    {
      name: 'minerboy-session',
      partialize: (state) => ({ 
        wallet: state.wallet,
        terminal: state.terminal.slice(-5), // Persist only last 5 lines
        mode: state.mode
      }),
    }
  )
);
