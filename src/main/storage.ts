import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { OmniRouterConfig, ChatSession } from '../shared/types';
import { DEFAULT_SYSTEM_PROMPT } from '../shared/defaultPrompt';

const DEFAULT_CONFIG: OmniRouterConfig = {
  baseUrl: 'https://api.omnirouter.ai/v1',
  apiKey: '',
  selectedModel: 'anthropic/claude-3.7-sonnet',
  customModelId: '',
  temperature: 0.2,
  maxTokens: 4096,
  safeMode: true,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
};

export class StorageManager {
  private baseDir: string;
  private configFile: string;
  private sessionsDir: string;

  constructor() {
    try {
      this.baseDir = path.join(app.getPath('userData'), 'omnicodex');
    } catch {
      // Fallback for non-packaged/standalone dev execution
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
      return { ...DEFAULT_CONFIG, ...parsed };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  async saveConfig(config: Partial<OmniRouterConfig>): Promise<OmniRouterConfig> {
    const current = await this.getConfig();
    const updated: OmniRouterConfig = { ...current, ...config };
    await fs.writeFile(this.configFile, JSON.stringify(updated, null, 2), 'utf-8');
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
    try {
      const file = path.join(this.sessionsDir, `${id}.json`);
      const raw = await fs.readFile(file, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async saveSession(session: ChatSession): Promise<void> {
    const file = path.join(this.sessionsDir, `${session.id}.json`);
    await fs.writeFile(file, JSON.stringify(session, null, 2), 'utf-8');
  }

  async deleteSession(id: string): Promise<boolean> {
    try {
      const file = path.join(this.sessionsDir, `${id}.json`);
      await fs.unlink(file);
      return true;
    } catch {
      return false;
    }
  }
}
