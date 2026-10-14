export const IPC_CHANNELS = {
  // Workspace
  WORKSPACE_OPEN_DIALOG: 'workspace:open-dialog',
  WORKSPACE_SET: 'workspace:set',
  WORKSPACE_GET_TREE: 'workspace:get-tree',
  WORKSPACE_GIT_STATUS: 'workspace:git-status',

  // File Operations
  FILES_READ: 'files:read',
  FILES_WRITE: 'files:write',
  FILES_APPLY_DIFF: 'files:apply-diff',
  FILES_SEARCH: 'files:search',

  // Terminal & Commands
  TERMINAL_EXECUTE: 'terminal:execute',
  TERMINAL_KILL: 'terminal:kill',
  TERMINAL_INPUT: 'terminal:input',

  // Config & Settings
  CONFIG_GET: 'config:get',
  CONFIG_SAVE: 'config:save',

  // Sessions Storage
  SESSIONS_LIST: 'sessions:list',
  SESSIONS_GET: 'sessions:get',
  SESSIONS_SAVE: 'sessions:save',
  SESSIONS_DELETE: 'sessions:delete',

  // OmniRouter
  OMNIROUTER_FETCH_MODELS: 'omnirouter:fetch-models',
  OMNIROUTER_TEST_CONNECTION: 'omnirouter:test-connection',

  // Agent Loop & Controls
  AGENT_SEND_MESSAGE: 'agent:send-message',
  AGENT_APPROVE_TOOL: 'agent:approve-tool',
  AGENT_REJECT_TOOL: 'agent:reject-tool',
  AGENT_CANCEL: 'agent:cancel',

  // Events (Main -> Renderer)
  EVENT_STREAM_CHUNK: 'event:agent-stream-chunk',
  EVENT_TOOL_CALL: 'event:agent-tool-call',
  EVENT_TERMINAL_OUTPUT: 'event:terminal-output',
  EVENT_WORKSPACE_CHANGED: 'event:workspace-changed',
  EVENT_GIT_UPDATED: 'event:git-updated',
} as const;
