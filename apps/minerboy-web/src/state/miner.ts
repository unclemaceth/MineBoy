import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type MiningState = 'idle' | 'mining' | 'found' | 'claiming';

export interface MinerState {
  // Connection & Mining State
  connected: boolean;
  mining: boolean;
  miningState: MiningState;
  attempts: number;
  hashRate: number; // H/s
  currentHash: string;
  foundHash: string | null;
  foundSuffix: string | null;
  
  // Terminal & UI
  terminal: string[];
  mode: 'terminal' | 'visual';
  booting: boolean;
  bootLines: string[];
  idleLines: string[];
  sessionId: string | null;
  
  // Actions
  connect: () => void;
  disconnect: () => void;
  pushLine: (line: string) => void;
  startMining: () => void;
  stopMining: () => void;
  toggleMining: () => void;
  setFoundHash: (hash: string | null) => void;
  tick: (data: { hash: string }) => void;
  setMode: (mode: 'terminal' | 'visual') => void;
  setHashRate: (rate: number) => void;
  setBooting: (booting: boolean) => void;
  setMiningState: (state: MiningState) => void;
}

export const useMinerStore = create<MinerState>()(
  persist(
    (set, get) => ({
      // Initial State
      connected: false,
      mining: false,
      miningState: 'idle',
      attempts: 0,
      hashRate: 0,
      currentHash: '0x000000000000000000000000000000000000000000000000000000000000000000',
      foundHash: null,
      foundSuffix: null,
      terminal: [],
      mode: 'terminal',
      booting: true,
      bootLines: [
        'MineBoy V 1.69.420 -',
        'MilkMan Operating System V 1.37',
        'Loading Sha Algo...',
        'Searching for Connection...',
        'Initializing CRT... OK',
        'Checking fans... SPINNING',
        'Ready for cartridge load...'
      ],
      idleLines: [
        'MineBoy Terminal v1.0',
        'Ready for mining...',
        'Press CONNECT to begin',
        'Use D-pad ← → to switch views'
      ],
      sessionId: null,
      
      // Actions
      connect: () => {
        set({ connected: true });
        get().pushLine('Connected to ApeChain Network');
        get().pushLine('Wallet Address: 0x...164');
        get().pushLine('Waiting for Cartridge Load...');
      },
      
      disconnect: () => {
        const state = get();
        if (state.mining) {
          state.stopMining();
        }
        set({ connected: false });
        get().pushLine('Disconnected.');
      },
      
      loadCartridge: (cartridgeType: string = 'ApeBit') => {
        get().pushLine(`${cartridgeType} Loaded`);
        get().pushLine('Enabling Mining Protocol...');
        get().pushLine('Press A to Mine...');
      },
      
      pushLine: (line: string) => {
        set((state) => {
          const newTerminal = [...state.terminal, line];
          // Keep max ~200 lines, trim oldest
          if (newTerminal.length > 200) {
            newTerminal.splice(0, newTerminal.length - 200);
          }
          return { terminal: newTerminal };
        });
      },
      
      startMining: () => {
        set({ mining: true, miningState: 'mining', mode: 'visual' }); // Auto-switch to visualizer
        get().pushLine('Mining started...');
      },
      
      stopMining: () => {
        set({ mining: false, miningState: 'idle' });
        get().pushLine('Mining stopped.');
      },
      
      toggleMining: () => {
        const state = get();
        if (state.mining) {
          state.stopMining();
        } else {
          state.startMining();
        }
      },
      
      setFoundHash: (hash: string | null) => {
        set({ foundHash: hash });
        if (hash) {
          get().pushLine(`Found hash: ${hash.slice(0, 10)}...${hash.slice(-6)}`);
        }
      },
      
      tick: (data: { hash: string }) => {
        set((state) => ({
          attempts: state.attempts + 1,
          currentHash: data.hash,
        }));
      },
      
      setMode: (mode: 'terminal' | 'visual') => {
        set({ mode });
      },
      
      setHashRate: (rate: number) => {
        set({ hashRate: rate });
      },
      
      setBooting: (booting: boolean) => {
        set({ booting });
        if (!booting) {
          // When boot completes, show idle lines
          const state = get();
          set({ terminal: [...state.idleLines] });
        }
      },
      
      setMiningState: (miningState: MiningState) => {
        set({ miningState });
      },
    }),
    {
      name: 'minerboy-state',
      // Only persist sessionId, not the volatile mining state
      partialize: (state) => ({ sessionId: state.sessionId }),
    }
  )
);
