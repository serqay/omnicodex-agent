import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import chokidar, { FSWatcher } from 'chokidar';
import { listDirectory } from './tools/fileTools';
import { FileNode, GitStatus } from '../shared/types';

const execAsync = promisify(exec);

export class WorkspaceManager {
  private currentPath: string = '';
  private watcher: FSWatcher | null = null;
  private onChangeCallbacks: Set<() => void> = new Set();

  setWorkspace(workspacePath: string): void {
    if (this.currentPath === workspacePath) return;

    this.currentPath = workspacePath;
    this.restartWatcher();
  }

  getWorkspace(): string {
    return this.currentPath || process.cwd();
  }

  async getFileTree(maxDepth = 4): Promise<FileNode[]> {
    const ws = this.getWorkspace();
    return await listDirectory(ws, '', true, maxDepth);
  }

  async getGitStatus(): Promise<GitStatus> {
    const ws = this.getWorkspace();
    const result: GitStatus = {
      branch: null,
      staged: [],
      modified: [],
      untracked: [],
      ahead: 0,
      behind: 0,
      isGitRepo: false,
    };

    try {
      const { stdout } = await execAsync('git status --porcelain=v1 -b', {
        cwd: ws,
        timeout: 5000,
      });

      result.isGitRepo = true;
      const lines = stdout.split(/\r?\n/).filter(Boolean);

      for (const line of lines) {
        if (line.startsWith('## ')) {
          // Branch header line: e.g. "## main...origin/main [ahead 1, behind 2]"
          const header = line.slice(3);
          const branchPart = header.split('...')[0].trim();
          result.branch = branchPart;

          const aheadMatch = header.match(/ahead (\d+)/);
          if (aheadMatch) result.ahead = parseInt(aheadMatch[1], 10);

          const behindMatch = header.match(/behind (\d+)/);
          if (behindMatch) result.behind = parseInt(behindMatch[1], 10);
        } else if (line.length >= 2) {
          const x = line[0];
          const y = line[1];
          const filePath = line.slice(3).trim();

          if (x === '?' && y === '?') {
            result.untracked.push(filePath);
          } else {
            if (x !== ' ' && x !== '?') {
              result.staged.push(filePath);
            }
            if (y !== ' ' && y !== '?') {
              result.modified.push(filePath);
            }
          }
        }
      }
    } catch {
      result.isGitRepo = false;
    }

    return result;
  }

  onWorkspaceChanged(cb: () => void): () => void {
    this.onChangeCallbacks.add(cb);
    return () => this.onChangeCallbacks.delete(cb);
  }

  private restartWatcher(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    if (!this.currentPath) return;

    let debounceTimer: NodeJS.Timeout | null = null;
    const notify = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.onChangeCallbacks.forEach((cb) => cb());
      }, 300);
    };

    this.watcher = chokidar.watch(this.currentPath, {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.omnicodex-data/**',
        '**/.gemini/**',
      ],
      ignoreInitial: true,
      depth: 4,
    });

    this.watcher
      .on('add', notify)
      .on('change', notify)
      .on('unlink', notify)
      .on('addDir', notify)
      .on('unlinkDir', notify);
  }

  dispose(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.onChangeCallbacks.clear();
  }
}

export const workspaceManager = new WorkspaceManager();
