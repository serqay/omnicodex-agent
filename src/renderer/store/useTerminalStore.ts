import { create } from 'zustand';

interface TerminalState {
  outputBuffer: string;
  history: string[];
  activeCommandId: string | null;
  appendOutput: (data: string) => void;
  clear: () => void;
  setActiveCommand: (id: string | null) => void;
  addHistory: (cmd: string) => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  outputBuffer: '',
  history: [],
  activeCommandId: null,
  appendOutput: (data) =>
    set((state) => ({ outputBuffer: state.outputBuffer + data })),
  clear: () => set({ outputBuffer: '' }),
  setActiveCommand: (id) => set({ activeCommandId: id }),
  addHistory: (cmd) =>
    set((state) => ({
      history: [cmd, ...state.history.filter((c) => c !== cmd)].slice(0, 50),
    })),
}));
