import { create } from 'zustand';

type S = { 
  isOpen: boolean; 
  open: () => void; 
  close: () => void; 
};

export const useWalletModal = create<S>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
