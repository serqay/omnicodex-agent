import { spawn, ChildProcess } from 'child_process';
import os from 'os';

export interface CommandExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export type OutputCallback = (chunk: string, type: 'stdout' | 'stderr' | 'system') => void;

class ProcessManager {
  private activeProcesses = new Map<string, ChildProcess>();

  private static readonly MAX_OUTPUT_BYTES = 5 * 1024 * 1024; // 5 MB buffer cap

  execute(
    commandId: string,
    command: string,
    cwd: string,
    onOutput?: OutputCallback,
    timeoutMs: number = 120000
  ): Promise<CommandExecutionResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const isWindows = os.platform() === 'win32';

      let shell: string;
      let args: string[];

      if (isWindows) {
        shell = 'powershell.exe';
        args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command];
      } else {
        shell = process.env.SHELL || '/bin/bash';
        args = ['-c', command];
      }

      onOutput?.(`> ${command}\r\n`, 'system');

      let proc: ChildProcess;
      try {
        proc = spawn(shell, args, {
          cwd,
          env: {
            ...process.env,
            FORCE_COLOR: '1',
            TERM: 'xterm-256color',
          },
          windowsHide: true,
          detached: !isWindows,
        });
      } catch (err: any) {
        const errMsg = `Failed to spawn process: ${err.message}\r\n`;
        onOutput?.(errMsg, 'stderr');
        resolve({
          stdout: '',
          stderr: errMsg,
          exitCode: 1,
          durationMs: Date.now() - startTime,
        });
        return;
      }

      this.activeProcesses.set(commandId, proc);

      let stdoutAccum = '';
      let stderrAccum = '';
      let timedOut = false;

      let timeoutTimer: NodeJS.Timeout | null = null;
      if (timeoutMs > 0) {
        timeoutTimer = setTimeout(() => {
          timedOut = true;
          onOutput?.(`\r\n[Command timed out after ${timeoutMs}ms. Terminating process...]\r\n`, 'stderr');
          this.kill(commandId);
        }, timeoutMs);
      }

      proc.stdout?.on('data', (data: Buffer) => {
        const str = data.toString();
        if (stdoutAccum.length < ProcessManager.MAX_OUTPUT_BYTES) {
          stdoutAccum += str;
        }
        onOutput?.(str, 'stdout');
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const str = data.toString();
        if (stderrAccum.length < ProcessManager.MAX_OUTPUT_BYTES) {
          stderrAccum += str;
        }
        onOutput?.(str, 'stderr');
      });

      proc.on('error', (err: Error) => {
        const errorStr = `Process error: ${err.message}\r\n`;
        stderrAccum += errorStr;
        onOutput?.(errorStr, 'stderr');
      });

      proc.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
        }
        this.activeProcesses.delete(commandId);

        // If killed by signal or null code, do NOT treat as exitCode 0
        let exitCode: number;
        if (code !== null) {
          exitCode = code;
        } else if (timedOut) {
          exitCode = 124; // Standard timeout exit code
        } else if (signal) {
          exitCode = 128 + 9; // 137 for SIGKILL/SIGTERM
        } else {
          exitCode = 1;
        }

        const durationMs = Date.now() - startTime;
        onOutput?.(`\r\n[Process completed with exit code ${exitCode} (${durationMs}ms)]\r\n`, 'system');

        resolve({
          stdout: stdoutAccum,
          stderr: stderrAccum,
          exitCode,
          durationMs,
        });
      });
    });
  }

  writeStdin(commandId: string, input: string): boolean {
    const proc = this.activeProcesses.get(commandId);
    if (proc && proc.stdin && proc.stdin.writable) {
      proc.stdin.write(input);
      return true;
    }
    return false;
  }

  kill(commandId: string): boolean {
    const proc = this.activeProcesses.get(commandId);
    if (proc) {
      if (os.platform() === 'win32' && proc.pid) {
        try {
          spawn('taskkill', ['/pid', proc.pid.toString(), '/T', '/F']);
        } catch {
          proc.kill();
        }
      } else if (proc.pid) {
        try {
          // Kill the process group on Unix
          process.kill(-proc.pid, 'SIGKILL');
        } catch {
          proc.kill('SIGKILL');
        }
      }
      this.activeProcesses.delete(commandId);
      return true;
    }
    return false;
  }

  killAll(): void {
    for (const [id] of this.activeProcesses) {
      this.kill(id);
    }
  }
}

export const processManager = new ProcessManager();
