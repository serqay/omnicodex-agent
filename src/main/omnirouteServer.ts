import net from 'net';
import { spawn, ChildProcess } from 'child_process';
import os from 'os';
import path from 'path';
import { shell } from 'electron';

export interface OmniRouteStatus {
  isRunning: boolean;
  port: number;
  dashboardUrl: string;
  apiUrl: string;
}

export class OmniRouteServerManager {
  private serverProcess: ChildProcess | null = null;
  private readonly port = 20128;
  private isStarting = false;

  getPort(): number {
    return this.port;
  }

  getDashboardUrl(): string {
    return `http://localhost:${this.port}/dashboard/providers`;
  }

  getApiUrl(): string {
    return `http://localhost:${this.port}/v1`;
  }

  async checkActive(timeoutMs = 1500): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let finished = false;

      socket.setTimeout(timeoutMs);

      socket.once('connect', () => {
        finished = true;
        socket.destroy();
        resolve(true);
      });

      socket.once('timeout', () => {
        if (!finished) {
          finished = true;
          socket.destroy();
          resolve(false);
        }
      });

      socket.once('error', () => {
        if (!finished) {
          finished = true;
          resolve(false);
        }
      });

      socket.connect(this.port, '127.0.0.1');
    });
  }

  async getStatus(): Promise<OmniRouteStatus> {
    const isRunning = await this.checkActive(1000);
    return {
      isRunning,
      port: this.port,
      dashboardUrl: this.getDashboardUrl(),
      apiUrl: this.getApiUrl(),
    };
  }

  async startServer(): Promise<{ success: boolean; message: string }> {
    const isAlreadyRunning = await this.checkActive(1000);
    if (isAlreadyRunning) {
      return {
        success: true,
        message: `OmniRoute is already running on port ${this.port}`,
      };
    }

    if (this.isStarting) {
      return { success: false, message: 'OmniRoute server startup is already in progress' };
    }

    this.isStarting = true;

    try {
      // Build extended environment PATH including typical Node/npm installation paths
      const homeDir = os.homedir();
      const nodePaths = [
        'D:\\node',
        path.join(homeDir, 'AppData', 'Roaming', 'npm'),
        path.join(homeDir, '.cargo', 'bin'),
        '/usr/local/bin',
        '/opt/homebrew/bin',
      ];
      const customPath = [...nodePaths, process.env.PATH || ''].join(path.delimiter);

      const isWindows = os.platform() === 'win32';
      const shellCmd = isWindows ? 'cmd.exe' : '/bin/bash';
      const shellArgs = isWindows
        ? ['/c', 'omniroute serve --no-open']
        : ['-c', 'omniroute serve --no-open'];

      const proc = spawn(shellCmd, shellArgs, {
        env: {
          ...process.env,
          PATH: customPath,
        },
        windowsHide: true,
        detached: true,
        stdio: 'ignore',
      });

      proc.unref();
      this.serverProcess = proc;

      // Poll until port 20128 becomes responsive (OmniRoute starts SQLite in ~10-15s)
      const maxRetries = 25;
      for (let i = 0; i < maxRetries; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const active = await this.checkActive(1000);
        if (active) {
          this.isStarting = false;
          return {
            success: true,
            message: `OmniRoute server started successfully on port ${this.port}`,
          };
        }
      }

      this.isStarting = false;
      return {
        success: false,
        message: 'OmniRoute process started but port 20128 did not respond within timeout',
      };
    } catch (err: any) {
      this.isStarting = false;
      return {
        success: false,
        message: `Failed to start OmniRoute server: ${err.message}`,
      };
    }
  }

  async openDashboard(): Promise<void> {
    await shell.openExternal(this.getDashboardUrl());
  }
}

export const omniRouteServer = new OmniRouteServerManager();
