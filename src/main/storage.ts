import { app, safeStorage } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { OmniRouterConfig, ChatSession } from '../shared/types';
import { DEFAULT_SYSTEM_PROMPT } from '../shared/defaultPrompt';

const DEFAULT_CONFIG: OmniRouterConfig = {
  baseUrl: 'http://localhost:20128/v1',
  apiKey: 'sk-328f1757130c8388-b8603c-8f78f948',
  selectedModel: 'gweb/gemini-3.7-flash',
  customModelId: '',
  temperature: 0.2,
  maxTokens: 4096,
  safeMode: true,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
};

async function atomicWriteFile(targetFile: string, content: string): Promise<void> {
  const tmpFile = `${targetFile}.tmp.${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await fs.writeFile(tmpFile, content, 'utf-8');
  await fs.rename(tmpFile, targetFile);
}

function sanitizeSessionId(id: string): string {
  if (!id || typeof id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error(`Security Violation: Invalid session identifier '${id}'`);
  }
  return id;
}

export class StorageManager {
  private baseDir: string;
  private configFile: string;
  private sessionsDir: string;

  constructor() {
    try {
      this.baseDir = path.join(app.getPath('userData'), 'omnicodex');
    } catch {
      // Fallback for non-packaged/standalone dev execution or tests
      this.baseDir = path.join(process.cwd(), '.omnicodex-data');
    }
    this.configFile = path.join(this.baseDir, 'config.json');
    this.sessionsDir = path.join(this.baseDir, 'sessions');
  }

  async init(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
    await fs.mkdir(this.sessionsDir, { recursive: true });
  }

  async getConfig(): Promise<OmniRouterConfig> {
    try {
      const data = await fs.readFile(this.configFile, 'utf-8');
      const parsed = JSON.parse(data);

      let decryptedKey = parsed.apiKey || '';
      if (parsed.encryptedApiKey && safeStorage && safeStorage.isEncryptionAvailable()) {
        try {
          decryptedKey = safeStorage.decryptString(Buffer.from(parsed.encryptedApiKey, 'hex'));
        } catch {
          decryptedKey = parsed.apiKey || '';
        }
      }

      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        apiKey: decryptedKey,
      };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  async saveConfig(config: Partial<OmniRouterConfig>): Promise<OmniRouterConfig> {
    const current = await this.getConfig();
    const updated: OmniRouterConfig = { ...current, ...config };

    const toStore: any = { ...updated };
    if (updated.apiKey && safeStorage && safeStorage.isEncryptionAvailable()) {
      try {
        toStore.encryptedApiKey = safeStorage.encryptString(updated.apiKey).toString('hex');
        delete toStore.apiKey; // Do not store plaintext key if encryption is available
      } catch {
        // Fallback to storing plaintext if encryption throws
      }
    }

    await atomicWriteFile(this.configFile, JSON.stringify(toStore, null, 2));
    return updated;
  }

  async listSessions(): Promise<ChatSession[]> {
    try {
      const files = await fs.readdir(this.sessionsDir);
      const sessions: ChatSession[] = [];
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const raw = await fs.readFile(path.join(this.sessionsDir, file), 'utf-8');
            sessions.push(JSON.parse(raw));
          } catch {
            // Ignore malformed files
          }
        }
      }
      return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  }

  async getSession(id: string): Promise<ChatSession | null> {
    const safeId = sanitizeSessionId(id);
    try {
      const file = path.join(this.sessionsDir, `${safeId}.json`);
      const raw = await fs.readFile(file, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async saveSession(session: ChatSession): Promise<void> {
    const safeId = sanitizeSessionId(session.id);
    session.updatedAt = Date.now();
    const file = path.join(this.sessionsDir, `${safeId}.json`);
    await atomicWriteFile(file, JSON.stringify(session, null, 2));
  }

  async deleteSession(id: string): Promise<boolean> {
    const safeId = sanitizeSessionId(id);
    try {
      const file = path.join(this.sessionsDir, `${safeId}.json`);
      await fs.unlink(file);
      return true;
    } catch {
      return false;
    }
  }
}
