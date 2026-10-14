import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc';
import {
  ChatSession,
  CommandPreview,
  DiffPreview,
  FileNode,
  GitStatus,
  OmniModel,
  OmniRouterConfig,
  StreamChunkEvent,
  TerminalOutputEvent,
  ToolCall,
} from '../shared/types';

export interface ElectronAPI {
  workspace: {
    openDialog: () => Promise<string | null>;
    set: (path: string) => Promise<boolean>;
    getTree: (maxDepth?: number) => Promise<FileNode[]>;
    getGitStatus: () => Promise<GitStatus>;
    onChanged: (callback: () => void) => () => void;
    onGitUpdated: (callback: (status: GitStatus) => void) => () => void;
  };
  files: {
    read: (path: string, startLine?: number, endLine?: number) => Promise<{
      content: string;
      rawContent: string;
      totalLines: number;
      startLine: number;
      endLine: number;
    }>;
    write: (path: string, content: string) => Promise<{ path: string; bytesWritten: number; lines: number }>;
    applyDiff: (path: string, searchBlock: string, replaceBlock: string) => Promise<DiffPreview>;
    search: (query: string, regex?: boolean) => Promise<Array<{ file: string; line: number; match: string }>>;
  };
  terminal: {
    execute: (commandId: string, command: string, cwd?: string) => Promise<any>;
    kill: (commandId: string) => Promise<boolean>;
    input: (commandId: string, input: string) => Promise<boolean>;
    onOutput: (callback: (event: TerminalOutputEvent) => void) => () => void;
  };
  config: {
    get: () => Promise<OmniRouterConfig>;
    save: (config: Partial<OmniRouterConfig>) => Promise<OmniRouterConfig>;
  };
  sessions: {
    list: () => Promise<ChatSession[]>;
    get: (id: string) => Promise<ChatSession | null>;
    save: (session: ChatSession) => Promise<void>;
    delete: (id: string) => Promise<boolean>;
  };
  omnirouter: {
    fetchModels: (baseUrl: string, apiKey: string) => Promise<OmniModel[]>;
    testConnection: (baseUrl: string, apiKey: string) => Promise<{ success: boolean; message: string; modelCount?: number }>;
  };
  omniroute: {
    getStatus: () => Promise<{ isRunning: boolean; port: number; dashboardUrl: string; apiUrl: string }>;
    start: () => Promise<{ success: boolean; message: string }>;
    openDashboard: () => Promise<boolean>;
  };
  agent: {
    sendMessage: (session: ChatSession, prompt: string, attachedFiles?: string[]) => Promise<ChatSession>;
    approveTool: (toolId: string) => Promise<boolean>;
    rejectTool: (toolId: string, feedback?: string) => Promise<boolean>;
    cancel: (sessionId: string) => Promise<boolean>;
    onStreamChunk: (callback: (event: StreamChunkEvent) => void) => () => void;
    onToolCall: (callback: (data: { sessionId: string; messageId: string; tool: ToolCall }) => void) => () => void;
  };
}

const api: ElectronAPI = {
  workspace: {
    openDialog: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_OPEN_DIALOG),
    set: (p: string) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SET, p),
    getTree: (depth?: number) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_GET_TREE, depth),
    getGitStatus: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_GIT_STATUS),
    onChanged: (cb: () => void) => {
      const listener = () => cb();
      ipcRenderer.on(IPC_CHANNELS.EVENT_WORKSPACE_CHANGED, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.EVENT_WORKSPACE_CHANGED, listener);
      };
    },
    onGitUpdated: (cb: (status: GitStatus) => void) => {
      const listener = (_: any, status: GitStatus) => cb(status);
      ipcRenderer.on(IPC_CHANNELS.EVENT_GIT_UPDATED, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.EVENT_GIT_UPDATED, listener);
      };
    },
  },
  files: {
    read: (p: string, startLine?: number, endLine?: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.FILES_READ, { path: p, startLine, endLine }),
    write: (p: string, content: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.FILES_WRITE, { path: p, content }),
    applyDiff: (p: string, searchBlock: string, replaceBlock: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.FILES_APPLY_DIFF, { path: p, searchBlock, replaceBlock }),
    search: (query: string, regex?: boolean) =>
      ipcRenderer.invoke(IPC_CHANNELS.FILES_SEARCH, { query, regex }),
  },
  terminal: {
    execute: (commandId: string, command: string, cwd?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_EXECUTE, { commandId, command, cwd }),
    kill: (commandId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_KILL, commandId),
    input: (commandId: string, input: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_INPUT, { commandId, input }),
    onOutput: (cb: (event: TerminalOutputEvent) => void) => {
      const listener = (_: any, ev: TerminalOutputEvent) => cb(ev);
      ipcRenderer.on(IPC_CHANNELS.EVENT_TERMINAL_OUTPUT, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.EVENT_TERMINAL_OUTPUT, listener);
      };
    },
  },
  config: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET),
    save: (cfg: Partial<OmniRouterConfig>) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SAVE, cfg),
  },
  sessions: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.SESSIONS_LIST),
    get: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.SESSIONS_GET, id),
    save: (session: ChatSession) => ipcRenderer.invoke(IPC_CHANNELS.SESSIONS_SAVE, session),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.SESSIONS_DELETE, id),
  },
  omnirouter: {
    fetchModels: (baseUrl: string, apiKey: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.OMNIROUTER_FETCH_MODELS, { baseUrl, apiKey }),
    testConnection: (baseUrl: string, apiKey: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.OMNIROUTER_TEST_CONNECTION, { baseUrl, apiKey }),
  },
  omniroute: {
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.OMNIROUTE_GET_STATUS),
    start: () => ipcRenderer.invoke(IPC_CHANNELS.OMNIROUTE_START),
    openDashboard: () => ipcRenderer.invoke(IPC_CHANNELS.OMNIROUTE_OPEN_DASHBOARD),
  },
  agent: {
    sendMessage: (session: ChatSession, prompt: string, attachedFiles?: string[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_SEND_MESSAGE, { session, prompt, attachedFiles }),
    approveTool: (toolId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_APPROVE_TOOL, toolId),
    rejectTool: (toolId: string, feedback?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_REJECT_TOOL, { toolId, feedback }),
    cancel: (sessionId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_CANCEL, sessionId),
    onStreamChunk: (cb: (event: StreamChunkEvent) => void) => {
      const listener = (_: any, ev: StreamChunkEvent) => cb(ev);
      ipcRenderer.on(IPC_CHANNELS.EVENT_STREAM_CHUNK, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.EVENT_STREAM_CHUNK, listener);
      };
    },
    onToolCall: (cb: (data: { sessionId: string; messageId: string; tool: ToolCall }) => void) => {
      const listener = (_: any, ev: { sessionId: string; messageId: string; tool: ToolCall }) => cb(ev);
      ipcRenderer.on(IPC_CHANNELS.EVENT_TOOL_CALL, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.EVENT_TOOL_CALL, listener);
      };
    },
  },
};

contextBridge.exposeInMainWorld('api', api);
