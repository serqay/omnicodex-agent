import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useTerminalStore } from '../../store/useTerminalStore';
import { useAppStore } from '../../store/useAppStore';
import { Terminal as TerminalIcon, Trash2, Play, Square, Copy, Check } from 'lucide-react';

export const TerminalView: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<Terminal | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);
  const lastWrittenLength = useRef<number>(0);

  const { outputBuffer, clear } = useTerminalStore();
  const { workspacePath } = useAppStore();
  const [manualCommand, setManualCommand] = useState('');
  const [isRunningManual, setIsRunningManual] = useState(false);
  const [runningCmdId, setRunningCmdId] = useState<string | null>(null);
  const runningCmdIdRef = useRef<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    runningCmdIdRef.current = runningCmdId;
  }, [runningCmdId]);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#09090b',
        foreground: '#f4f4f5',
        cursor: '#fafafa',
        selectionBackground: '#27272a',
        black: '#18181b',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f4f4f5',
      },
      fontFamily: "'JetBrains Mono', 'Geist Mono', monospace",
      fontSize: 12,
      lineHeight: 1.3,
      cursorBlink: true,
      convertEol: true,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermInstance.current = term;
    fitAddonInstance.current = fitAddon;

    term.writeln('\x1b[38;5;244m[OmniCodex Terminal Ready - Workspace Command Runner]\x1b[0m\r\n');

    // Interactive stdin forwarding to active process
    const dataDisposable = term.onData((data) => {
      if (runningCmdIdRef.current && window.api) {
        window.api.terminal.input(runningCmdIdRef.current, data);
      }
    });

    // If buffer had previous content
    if (outputBuffer) {
      term.write(outputBuffer);
      lastWrittenLength.current = outputBuffer.length;
    }

    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch {
        // ignore resize error during layout transitions
      }
    };

    window.addEventListener('resize', handleResize);

    const observer = new ResizeObserver(() => {
      handleResize();
    });
    observer.observe(terminalRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      dataDisposable.dispose();
      term.dispose();
      xtermInstance.current = null;
    };
  }, []);

  // Sync new terminal output
  useEffect(() => {
    if (!xtermInstance.current) return;

    if (outputBuffer.length > lastWrittenLength.current) {
      const delta = outputBuffer.slice(lastWrittenLength.current);
      xtermInstance.current.write(delta);
      lastWrittenLength.current = outputBuffer.length;
    } else if (outputBuffer.length < lastWrittenLength.current) {
      // Buffer was cleared
      xtermInstance.current.clear();
      xtermInstance.current.write(outputBuffer);
      lastWrittenLength.current = outputBuffer.length;
    }
  }, [outputBuffer]);

  const handleClear = () => {
    clear();
    lastWrittenLength.current = 0;
    xtermInstance.current?.clear();
  };

  const handleCopy = () => {
    // Strip ANSI color codes before copying to system clipboard
    const cleanText = outputBuffer.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
    navigator.clipboard.writeText(cleanText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleExecuteManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCommand.trim() || isRunningManual || !window.api) return;

    const cmd = manualCommand.trim();
    setManualCommand('');
    const cmdId = `manual_${Date.now()}`;
    setRunningCmdId(cmdId);
    setIsRunningManual(true);

    try {
      await window.api.terminal.execute(cmdId, cmd, workspacePath);
    } finally {
      setIsRunningManual(false);
      setRunningCmdId(null);
    }
  };

  const handleStopManual = () => {
    if (runningCmdId && window.api) {
      window.api.terminal.kill(runningCmdId);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Terminal Top Bar */}
      <div className="h-9 px-3 border-b border-border bg-card flex items-center justify-between select-none shrink-0">
        <div className="flex items-center gap-2 font-mono text-xs text-foreground">
          <TerminalIcon className="w-3.5 h-3.5 text-foreground" />
          <span className="font-semibold">Terminal</span>
          <span className="text-xs text-muted-foreground truncate max-w-xs">
            {workspacePath || 'No workspace'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="h-6 px-2 flex items-center gap-1 rounded-sm bg-muted/60 hover:bg-muted text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
            title="Copy clean terminal text"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-foreground" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{isCopied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleClear}
            className="h-6 px-2 flex items-center gap-1 rounded-sm hover:bg-accent text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
            title="Clear terminal"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* xterm.js viewport */}
      <div className="flex-1 p-2 bg-background min-h-0 overflow-hidden" ref={terminalRef} />

      {/* Manual Command Input */}
      <form
        onSubmit={handleExecuteManual}
        className="h-10 border-t border-border bg-card px-2 flex items-center gap-2 select-none shrink-0"
      >
        <span className="font-mono text-xs text-muted-foreground select-none pl-1">$</span>
        <input
          type="text"
          value={manualCommand}
          onChange={(e) => setManualCommand(e.target.value)}
          placeholder="Run shell command in workspace (e.g. npm test, git status)..."
          disabled={isRunningManual}
          className="flex-1 bg-transparent border-0 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {isRunningManual ? (
          <button
            type="button"
            onClick={handleStopManual}
            className="h-7 px-3 bg-destructive text-destructive-foreground hover:opacity-90 rounded-md text-xs font-mono font-medium flex items-center gap-1 transition-opacity"
            title="Stop running command"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Stop</span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!manualCommand.trim()}
            className="h-7 px-3 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 rounded-md text-xs font-mono font-medium flex items-center gap-1 transition-opacity"
          >
            <Play className="w-3 h-3" />
            <span>Run</span>
          </button>
        )}
      </form>
    </div>
  );
};
