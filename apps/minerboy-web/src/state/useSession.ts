import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartridgeConfig, Job, OpenSessionRes } from '@minerboy/shared/mining';

type FoundPayload = { hash: `0x${string}`; preimage: string; attempts: number; hr: number };

type SessionState = {
  // Connection state
  wallet?: `0x${string}`;
  cartridge?: { info: CartridgeConfig; tokenId: string };
  sessionId?: string;
  job?: Job;
  
  // Mining state
  mining: boolean;
  attempts: number;
  hr: number;
  lastFound?: FoundPayload;
  
  // Terminal state (keep for UI compatibility)
  terminal: string[];
  mode: 'terminal' | 'visual';
  
  // Actions
  setWallet(addr?: `0x${string}`): void;
  setMining(on: boolean): void;
  setTelemetry(a: number, hr: number): void;
  setFound(p: FoundPayload | undefined): void;
  pushLine(line: string): void;
  setMode(mode: 'terminal' | 'visual'): void;
  
  loadOpenSession(res: OpenSessionRes, wallet: `0x${string}`, cartridge: { info: CartridgeConfig; tokenId: string }): void;
  clear(): void;
};

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      // Initial state
      mining: false,
      attempts: 0,
      hr: 0,
      terminal: [],
      mode: 'terminal',
      
      // Actions
      setWallet: (wallet) => set({ wallet }),
      setMining: (mining) => set({ mining }),
      setTelemetry: (attempts, hr) => set({ attempts, hr }),
      setFound: (p) => set({ lastFound: p }),
      
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
        
        // Add connection message to terminal
        get().pushLine(`Connected to ${cartridge.info.name}`);
        get().pushLine(`Session: ${res.sessionId.slice(0, 8)}...`);
        get().pushLine('Press A to start mining');
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
