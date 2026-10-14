import { create } from 'zustand';
import {
  ChatMessage,
  ChatSession,
  FileNode,
  GitStatus,
  OmniModel,
  OmniRouterConfig,
  StreamChunkEvent,
  ToolCall,
} from '../../shared/types';
import { useTerminalStore } from './useTerminalStore';
import { useDiffStore } from './useDiffStore';

const DEFAULT_CONFIG: OmniRouterConfig = {
  baseUrl: 'https://api.omnirouter.ai/v1',
  apiKey: '',
  selectedModel: 'anthropic/claude-3.7-sonnet',
  customModelId: '',
  temperature: 0.2,
  maxTokens: 4096,
  safeMode: true,
  systemPrompt: '',
};

interface AppState {
  workspacePath: string;
  fileTree: FileNode[];
  gitStatus: GitStatus | null;
  sessions: ChatSession[];
  activeSessionId: string | null;
  activeSession: ChatSession | null;
  config: OmniRouterConfig;
  models: OmniModel[];
  isLoadingModels: boolean;
  isStreaming: boolean;
  streamingMessageId: string | null;
  streamingText: string;
  streamingReasoning: string;
  activeTools: Map<string, ToolCall>;
  isSettingsOpen: boolean;

  // Actions
  initialize: () => Promise<void>;
  openWorkspaceDialog: () => Promise<void>;
  setWorkspace: (path: string) => Promise<void>;
  refreshFileTree: () => Promise<void>;
  refreshGitStatus: () => Promise<void>;
  fetchModels: () => Promise<void>;
  createSession: () => Promise<string>;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => Promise<void>;
  sendMessage: (prompt: string, attachedFiles?: string[]) => Promise<void>;
  approveTool: (toolId: string) => Promise<void>;
  rejectTool: (toolId: string, feedback?: string) => Promise<void>;
  cancelGeneration: () => Promise<void>;
  toggleSafeMode: () => Promise<void>;
  saveConfig: (partial: Partial<OmniRouterConfig>) => Promise<void>;
  setSettingsOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  workspacePath: '',
  fileTree: [],
  gitStatus: null,
  sessions: [],
  activeSessionId: null,
  activeSession: null,
  config: DEFAULT_CONFIG,
  models: [],
  isLoadingModels: false,
  isStreaming: false,
  streamingMessageId: null,
  streamingText: '',
  streamingReasoning: '',
  activeTools: new Map(),
  isSettingsOpen: false,

  initialize: async () => {
    if (typeof window === 'undefined' || !window.api) return;

    // Load configuration
    const config = await window.api.config.get();
    set({ config });

    // Initial file tree & git status
    const tree = await window.api.workspace.getTree();
    const git = await window.api.workspace.getGitStatus();
    set({ fileTree: tree, gitStatus: git });

    // Load sessions
    const sessions = await window.api.sessions.list();
    if (sessions.length > 0) {
      set({ sessions, activeSessionId: sessions[0].id, activeSession: sessions[0] });
    } else {
      await get().createSession();
    }

    // Try fetching models if API key exists
    if (config.apiKey) {
      get().fetchModels().catch(() => {});
    }

    // Register event listeners
    window.api.workspace.onChanged(() => {
      get().refreshFileTree();
    });

    window.api.workspace.onGitUpdated((status) => {
      set({ gitStatus: status });
    });

    window.api.terminal.onOutput((ev) => {
      useTerminalStore.getState().appendOutput(ev.data);
    });

    window.api.agent.onStreamChunk((ev: StreamChunkEvent) => {
      const state = get();
      if (state.activeSessionId !== ev.sessionId) return;

      if (ev.deltaText) {
        set((s) => ({ isStreaming: true, streamingText: s.streamingText + ev.deltaText }));
      }
      if (ev.deltaReasoning) {
        set((s) => ({ isStreaming: true, streamingReasoning: s.streamingReasoning + ev.deltaReasoning }));
      }

      if (ev.finished === false && ev.finishReason === 'tool_calls') {
        // Intermediate assistant turn with tool calls finished streaming
        set({
          streamingText: '',
          streamingReasoning: '',
        });
        window.api.sessions.get(ev.sessionId).then((updated) => {
          if (updated) {
            set((s) => ({
              activeSession: updated,
              sessions: s.sessions.map((sess) => (sess.id === updated.id ? updated : sess)),
            }));
          }
        });
      }

      if (ev.finished) {
        // Overall agent loop completed
        set({
          isStreaming: false,
          streamingMessageId: null,
          streamingText: '',
          streamingReasoning: '',
        });
        // Reload active session
        window.api.sessions.get(ev.sessionId).then((updated) => {
          if (updated) {
            set((s) => ({
              activeSession: updated,
              sessions: s.sessions.map((sess) => (sess.id === updated.id ? updated : sess)),
            }));
          }
        });
      }
    });

    window.api.agent.onToolCall((data) => {
      const state = get();
      if (state.activeSessionId !== data.sessionId) return;

      const updatedTools = new Map(state.activeTools);
      updatedTools.set(data.tool.id, data.tool);
      set({ activeTools: updatedTools });

      // Automatically open diff preview if diff tool
      if (data.tool.diffPreview) {
        useDiffStore.getState().setDiff(data.tool.diffPreview);
      }

      // If tool execution involved commands, switch to terminal tab
      if (data.tool.name === 'execute_command') {
        useDiffStore.getState().setActiveTab('terminal');
      }
    });
  },

  openWorkspaceDialog: async () => {
    if (!window.api) return;
    const selected = await window.api.workspace.openDialog();
    if (selected) {
      set({ workspacePath: selected });
      await get().refreshFileTree();
      await get().refreshGitStatus();
    }
  },

  setWorkspace: async (path: string) => {
    if (!window.api) return;
    await window.api.workspace.set(path);
    set({ workspacePath: path });
    await get().refreshFileTree();
    await get().refreshGitStatus();
  },

  refreshFileTree: async () => {
    if (!window.api) return;
    const tree = await window.api.workspace.getTree();
    set({ fileTree: tree });
  },

  refreshGitStatus: async () => {
    if (!window.api) return;
    const git = await window.api.workspace.getGitStatus();
    set({ gitStatus: git });
  },

  fetchModels: async () => {
    if (!window.api) return;
    const { baseUrl, apiKey } = get().config;
    if (!apiKey && !baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1')) return;

    set({ isLoadingModels: true });
    try {
      const models = await window.api.omnirouter.fetchModels(baseUrl, apiKey);
      set({ models, isLoadingModels: false });
    } catch (err) {
      set({ isLoadingModels: false });
      throw err;
    }
  },

  createSession: async () => {
    const newSession: ChatSession = {
      id: `session_${Date.now()}`,
      title: 'New Task',
      workspacePath: get().workspacePath,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };

    if (window.api) {
      await window.api.sessions.save(newSession);
    }

    set((state) => ({
      sessions: [newSession, ...state.sessions],
      activeSessionId: newSession.id,
      activeSession: newSession,
      activeTools: new Map(),
      streamingText: '',
      streamingReasoning: '',
    }));

    return newSession.id;
  },

  switchSession: (id: string) => {
    const session = get().sessions.find((s) => s.id === id) || null;
    set({
      activeSessionId: id,
      activeSession: session,
      activeTools: new Map(),
      streamingText: '',
      streamingReasoning: '',
    });
  },

  deleteSession: async (id: string) => {
    if (window.api) {
      await window.api.sessions.delete(id);
    }
    const remaining = get().sessions.filter((s) => s.id !== id);
    if (remaining.length === 0) {
      set({ sessions: [] });
      await get().createSession();
    } else {
      const nextActive = remaining[0];
      set({
        sessions: remaining,
        activeSessionId: nextActive.id,
        activeSession: nextActive,
      });
    }
  },

  sendMessage: async (prompt: string, attachedFiles = []) => {
    const state = get();
    if (!state.activeSession || !window.api) return;

    const session = state.activeSession;
    if (session.messages.length === 0) {
      // Name session after first user message
      session.title = prompt.slice(0, 32).trim() || 'Task';
    }

    set({
      isStreaming: true,
      streamingText: '',
      streamingReasoning: '',
    });

    try {
      const updatedSession = await window.api.agent.sendMessage(session, prompt, attachedFiles);
      set((s) => ({
        activeSession: updatedSession,
        sessions: s.sessions.map((sess) => (sess.id === updatedSession.id ? updatedSession : sess)),
        isStreaming: false,
      }));
    } catch (err: any) {
      set({ isStreaming: false });
      // Add error message to active session
      const errorMsg: ChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content: `**Error running agent:** ${err.message || 'Unknown error'}`,
        timestamp: Date.now(),
      };
      session.messages.push(errorMsg);
      set({ activeSession: { ...session } });
      await window.api.sessions.save(session);
    }
  },

  approveTool: async (toolId: string) => {
    if (!window.api) return;
    await window.api.agent.approveTool(toolId);
    set((state) => {
      const updated = new Map(state.activeTools);
      const tool = updated.get(toolId);
      if (tool) {
        tool.status = 'approved';
        updated.set(toolId, { ...tool });
      }
      return { activeTools: updated };
    });
  },

  rejectTool: async (toolId: string, feedback?: string) => {
    if (!window.api) return;
    await window.api.agent.rejectTool(toolId, feedback);
    set((state) => {
      const updated = new Map(state.activeTools);
      const tool = updated.get(toolId);
      if (tool) {
        tool.status = 'rejected';
        tool.error = feedback || 'Rejected by user';
        updated.set(toolId, { ...tool });
      }
      return { activeTools: updated };
    });
  },

  cancelGeneration: async () => {
    const state = get();
    if (!state.activeSessionId || !window.api) return;
    await window.api.agent.cancel(state.activeSessionId);
    set({
      isStreaming: false,
      streamingText: '',
      streamingReasoning: '',
    });
  },

  toggleSafeMode: async () => {
    const current = get().config;
    await get().saveConfig({ safeMode: !current.safeMode });
  },

  saveConfig: async (partial) => {
    if (!window.api) return;
    const updated = await window.api.config.save(partial);
    set({ config: updated });
  },

  setSettingsOpen: (open: boolean) => set({ isSettingsOpen: open }),
}));
