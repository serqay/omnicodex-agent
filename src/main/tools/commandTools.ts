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

  execute(
    commandId: string,
    command: string,
    cwd: string,
    onOutput?: OutputCallback
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

      proc.stdout?.on('data', (data: Buffer) => {
        const str = data.toString();
        stdoutAccum += str;
        onOutput?.(str, 'stdout');
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const str = data.toString();
        stderrAccum += str;
        onOutput?.(str, 'stderr');
      });

      proc.on('error', (err: Error) => {
        const errorStr = `Process error: ${err.message}\r\n`;
        stderrAccum += errorStr;
        onOutput?.(errorStr, 'stderr');
      });

      proc.on('close', (code: number | null) => {
        this.activeProcesses.delete(commandId);
        const exitCode = code ?? 0;
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
      } else {
        proc.kill('SIGTERM');
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
