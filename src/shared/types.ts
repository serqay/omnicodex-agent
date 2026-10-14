export interface WorkspaceInfo {
  path: string;
  name: string;
  gitBranch: string | null;
  gitClean: boolean;
  gitModifiedCount: number;
}

export interface FileNode {
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
  children?: FileNode[];
  size?: number;
  extension?: string;
}

export interface OmniRouterConfig {
  baseUrl: string;
  apiKey: string;
  selectedModel: string;
  customModelId: string;
  temperature: number;
  maxTokens: number;
  safeMode: boolean; // true = Human-in-the-Loop, false = YOLO Mode
  systemPrompt: string;
}

export interface OmniModel {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
  context_length?: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface DiffPreview {
  path: string;
  relativePath: string;
  originalContent: string;
  newContent: string;
  searchBlock?: string;
  replaceBlock?: string;
  addedLines: number;
  deletedLines: number;
}

export interface CommandPreview {
  command: string;
  cwd: string;
}

export type ToolStatus =
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'running'
  | 'completed'
  | 'error';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  rawArguments?: string;
  status: ToolStatus;
  result?: any;
  error?: string;
  diffPreview?: DiffPreview;
  commandPreview?: CommandPreview;
  timestamp: number;
  durationMs?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  reasoningContent?: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  name?: string;
  tokenUsage?: TokenUsage;
  attachedFiles?: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  workspacePath: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  totalTokens?: TokenUsage;
}

export interface GitStatus {
  branch: string | null;
  staged: string[];
  modified: string[];
  untracked: string[];
  ahead: number;
  behind: number;
  isGitRepo: boolean;
}

export interface StreamChunkEvent {
  sessionId: string;
  messageId: string;
  deltaText?: string;
  deltaReasoning?: string;
  toolCallDelta?: {
    index: number;
    id?: string;
    name?: string;
    argumentsDelta?: string;
  };
  finished?: boolean;
  finishReason?: string;
  tokenUsage?: TokenUsage;
  error?: string;
}

export interface TerminalOutputEvent {
  commandId: string;
  data: string;
  type: 'stdout' | 'stderr' | 'system';
}
