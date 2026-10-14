import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { StorageManager } from './storage';
import { workspaceManager } from './workspace';
import { AgentLoopManager } from './agentLoop';
import { omniRouterClient } from './omnirouter';
import { processManager } from './tools/commandTools';
import { readFile, writeFile, searchFiles } from './tools/fileTools';
import { applyDiff } from './tools/diffTools';
import { IPC_CHANNELS } from '../shared/ipc';
import { OmniRouterConfig, ChatSession } from '../shared/types';

let mainWindow: BrowserWindow | null = null;
const storage = new StorageManager();
const agentLoop = new AgentLoopManager(storage);

async function createWindow() {
  await storage.init();

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#09090b',
    titleBarStyle: 'default',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Watcher notifications -> Renderer
  workspaceManager.onWorkspaceChanged(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.EVENT_WORKSPACE_CHANGED);
      workspaceManager.getGitStatus().then((gitStatus) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.EVENT_GIT_UPDATED, gitStatus);
        }
      });
    }
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (isDev) {
    const devUrl = 'http://localhost:5173';
    try {
      // Try connecting to Vite dev server first
      await mainWindow.loadURL(devUrl);
    } catch {
      // Fallback to built renderer HTML
      const indexPath = path.join(__dirname, '../renderer/index.html');
      await mainWindow.loadFile(indexPath);
    }
  } else {
    // In production packaged mode, directly load the compiled renderer
    const indexPath = path.join(__dirname, '../renderer/index.html');
    await mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// -------------------------------------------------------------
// IPC Handlers Registration
// -------------------------------------------------------------
function registerIpcHandlers() {
  // Workspace
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_OPEN_DIALOG, async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Workspace Folder',
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const selected = result.filePaths[0];
    workspaceManager.setWorkspace(selected);
    return selected;
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_SET, async (_, workspacePath: string) => {
    workspaceManager.setWorkspace(workspacePath);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GET_TREE, async (_, maxDepth?: number) => {
    return await workspaceManager.getFileTree(maxDepth);
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GIT_STATUS, async () => {
    return await workspaceManager.getGitStatus();
  });

  // Files
  ipcMain.handle(IPC_CHANNELS.FILES_READ, async (_, { path: relPath, startLine, endLine }) => {
    const ws = workspaceManager.getWorkspace();
    return await readFile(ws, relPath, startLine, endLine);
  });

  ipcMain.handle(IPC_CHANNELS.FILES_WRITE, async (_, { path: relPath, content }) => {
    const ws = workspaceManager.getWorkspace();
    return await writeFile(ws, relPath, content);
  });

  ipcMain.handle(IPC_CHANNELS.FILES_APPLY_DIFF, async (_, { path: relPath, searchBlock, replaceBlock }) => {
    const ws = workspaceManager.getWorkspace();
    return await applyDiff(ws, relPath, searchBlock, replaceBlock);
  });

  ipcMain.handle(IPC_CHANNELS.FILES_SEARCH, async (_, { query, regex }) => {
    const ws = workspaceManager.getWorkspace();
    return await searchFiles(ws, query, regex);
  });

  // Terminal
  ipcMain.handle(IPC_CHANNELS.TERMINAL_EXECUTE, async (_, { commandId, command, cwd }) => {
    const ws = cwd || workspaceManager.getWorkspace();
    return await processManager.execute(
      commandId,
      command,
      ws,
      (data, type) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.EVENT_TERMINAL_OUTPUT, {
            commandId,
            data,
            type,
          });
        }
      }
    );
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL_KILL, async (_, commandId: string) => {
    return processManager.kill(commandId);
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL_INPUT, async (_, { commandId, input }) => {
    return processManager.writeStdin(commandId, input);
  });

  // Config
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, async () => {
    return await storage.getConfig();
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_SAVE, async (_, config: Partial<OmniRouterConfig>) => {
    return await storage.saveConfig(config);
  });

  // Sessions
  ipcMain.handle(IPC_CHANNELS.SESSIONS_LIST, async () => {
    return await storage.listSessions();
  });

  ipcMain.handle(IPC_CHANNELS.SESSIONS_GET, async (_, id: string) => {
    return await storage.getSession(id);
  });

  ipcMain.handle(IPC_CHANNELS.SESSIONS_SAVE, async (_, session: ChatSession) => {
    return await storage.saveSession(session);
  });

  ipcMain.handle(IPC_CHANNELS.SESSIONS_DELETE, async (_, id: string) => {
    return await storage.deleteSession(id);
  });

  // OmniRouter
  ipcMain.handle(IPC_CHANNELS.OMNIROUTER_FETCH_MODELS, async (_, { baseUrl, apiKey }) => {
    return await omniRouterClient.fetchModels(baseUrl, apiKey);
  });

  ipcMain.handle(IPC_CHANNELS.OMNIROUTER_TEST_CONNECTION, async (_, { baseUrl, apiKey }) => {
    return await omniRouterClient.testConnection(baseUrl, apiKey);
  });

  // Agent Loop
  ipcMain.handle(IPC_CHANNELS.AGENT_SEND_MESSAGE, async (_, { session, prompt, attachedFiles }) => {
    if (!mainWindow) throw new Error('Main window not available');
    return await agentLoop.runLoop(session, prompt, attachedFiles, mainWindow.webContents);
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_APPROVE_TOOL, async (_, toolId: string) => {
    return agentLoop.approveTool(toolId);
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_REJECT_TOOL, async (_, { toolId, feedback }) => {
    return agentLoop.rejectTool(toolId, feedback);
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_CANCEL, async (_, sessionId: string) => {
    agentLoop.cancel(sessionId);
    return true;
  });
}

// -------------------------------------------------------------
// App Lifecycle
// -------------------------------------------------------------
app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  workspaceManager.dispose();
  processManager.killAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
