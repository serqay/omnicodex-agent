import { create } from 'zustand';
import { DiffPreview } from '../../shared/types';

export type RightPanelTab = 'diff' | 'terminal' | 'editor';

interface DiffState {
  activeTab: RightPanelTab;
  currentDiff: DiffPreview | null;
  currentFile: {
    path: string;
    relativePath: string;
    content: string;
    language: string;
  } | null;
  setActiveTab: (tab: RightPanelTab) => void;
  setDiff: (diff: DiffPreview | null) => void;
  openFile: (file: { path: string; relativePath: string; content: string; language: string }) => void;
  closeFile: () => void;
}

function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'json':
      return 'json';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'py':
      return 'python';
    case 'rs':
      return 'rust';
    case 'go':
      return 'go';
    case 'md':
      return 'markdown';
    case 'sh':
    case 'bash':
    case 'ps1':
      return 'shell';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'sql':
      return 'sql';
    default:
      return 'plaintext';
  }
}

export const useDiffStore = create<DiffState>((set) => ({
  activeTab: 'terminal',
  currentDiff: null,
  currentFile: null,
  setActiveTab: (tab) => set({ activeTab: tab }),
  setDiff: (diff) => set({ currentDiff: diff, activeTab: diff ? 'diff' : 'terminal' }),
  openFile: (file) =>
    set({
      currentFile: {
        ...file,
        language: file.language || detectLanguage(file.path),
      },
      activeTab: 'editor',
    }),
  closeFile: () => set({ currentFile: null, activeTab: 'terminal' }),
}));
