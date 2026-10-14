import React, { useState } from 'react';
import { ToolCall } from '../../../shared/types';
import { useAppStore } from '../../store/useAppStore';
import { useDiffStore } from '../../store/useDiffStore';
import {
  ChevronDown,
  ChevronRight,
  Terminal,
  FileEdit,
  FolderOpen,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ShieldAlert,
  Loader2,
} from 'lucide-react';

interface ToolCallCardProps {
  tool: ToolCall;
}

function getToolIcon(name: string) {
  switch (name) {
    case 'execute_command':
      return <Terminal className="w-3.5 h-3.5 text-foreground" />;
    case 'apply_diff':
    case 'write_file':
      return <FileEdit className="w-3.5 h-3.5 text-foreground" />;
    case 'read_file':
    case 'list_directory':
      return <FolderOpen className="w-3.5 h-3.5 text-foreground" />;
    case 'search_files':
      return <Search className="w-3.5 h-3.5 text-foreground" />;
    default:
      return <Terminal className="w-3.5 h-3.5 text-muted-foreground" />;
  }
}

export const ToolCallCard: React.FC<ToolCallCardProps> = ({ tool }) => {
  const [isExpanded, setIsExpanded] = useState(
    tool.status === 'pending_approval' || tool.status === 'running' || tool.status === 'error'
  );
  const { approveTool, rejectTool } = useAppStore();
  const { setDiff, setActiveTab } = useDiffStore();

  const handleOpenDiff = () => {
    if (tool.diffPreview) {
      setDiff(tool.diffPreview);
      setActiveTab('diff');
    }
  };

  const handleOpenTerminal = () => {
    setActiveTab('terminal');
  };

  return (
    <div
      className={`my-2 rounded-md border text-xs overflow-hidden transition-all ${
        tool.status === 'pending_approval'
          ? 'border-primary/50 bg-card ring-1 ring-primary/20'
          : tool.status === 'error' || tool.status === 'rejected'
          ? 'border-destructive/40 bg-destructive/10'
          : 'border-border bg-card'
      }`}
    >
      {/* Header bar */}
      <div className="px-3 py-2 flex items-center justify-between bg-muted/40 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {getToolIcon(tool.name)}
          <span className="font-mono font-medium text-foreground truncate">{tool.name}</span>

          {/* Quick parameter summary */}
          <span className="text-muted-foreground font-mono text-xs truncate max-w-xs">
            {tool.name === 'execute_command' && tool.arguments.command}
            {tool.name === 'read_file' && tool.arguments.path}
            {tool.name === 'write_file' && tool.arguments.path}
            {tool.name === 'apply_diff' && tool.arguments.path}
            {tool.name === 'list_directory' && (tool.arguments.path || './')}
            {tool.name === 'search_files' && `"${tool.arguments.query}"`}
          </span>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2 shrink-0">
          {tool.durationMs !== undefined && (
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              {tool.durationMs}ms
            </span>
          )}

          {tool.status === 'pending_approval' && (
            <span className="flex items-center gap-1 text-xs font-mono text-foreground bg-muted border border-border px-2 py-0.5 rounded-sm animate-pulse">
              <ShieldAlert className="w-3.5 h-3.5 text-foreground" />
              <span>Approval Required</span>
            </span>
          )}

          {tool.status === 'running' && (
            <span className="flex items-center gap-1 text-xs font-mono text-foreground bg-muted border border-border px-2 py-0.5 rounded-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Running</span>
            </span>
          )}

          {tool.status === 'completed' && (
            <span className="flex items-center gap-1 text-xs font-mono text-foreground bg-muted border border-border px-2 py-0.5 rounded-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-foreground" />
              <span>Success</span>
            </span>
          )}

          {tool.status === 'rejected' && (
            <span className="flex items-center gap-1 text-xs font-mono text-destructive bg-destructive/10 border border-destructive/30 px-2 py-0.5 rounded-sm">
              <XCircle className="w-3.5 h-3.5" />
              <span>Rejected</span>
            </span>
          )}

          {tool.status === 'error' && (
            <span className="flex items-center gap-1 text-xs font-mono text-destructive bg-destructive/10 border border-destructive/30 px-2 py-0.5 rounded-sm">
              <XCircle className="w-3.5 h-3.5" />
              <span>Failed</span>
            </span>
          )}
        </div>
      </div>

      {/* Human-in-the-Loop Safe Mode Approval Banner */}
      {tool.status === 'pending_approval' && (
        <div className="px-3 py-2.5 bg-muted/30 border-t border-border flex flex-col gap-2">
          <div className="text-xs text-foreground font-medium flex items-center justify-between">
            <span>Agent requests confirmation before modifying files or executing shell commands:</span>
            {tool.diffPreview && (
              <button
                onClick={handleOpenDiff}
                className="flex items-center gap-1 text-xs text-foreground underline hover:opacity-80 font-mono"
              >
                <span>View Full Diff</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
            {tool.commandPreview && (
              <button
                onClick={handleOpenTerminal}
                className="flex items-center gap-1 text-xs text-foreground underline hover:opacity-80 font-mono"
              >
                <span>Open Terminal</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action preview */}
          {tool.commandPreview && (
            <div className="p-2 bg-background border border-border rounded-md font-mono text-xs text-foreground">
              <code>$ {tool.commandPreview.command}</code>
              <div className="text-xs text-muted-foreground mt-0.5">
                cwd: {tool.commandPreview.cwd}
              </div>
            </div>
          )}

          {tool.diffPreview && (
            <div className="p-2 bg-background border border-border rounded-md font-mono text-xs">
              <div className="text-foreground font-semibold mb-1">
                {tool.diffPreview.relativePath}
              </div>
              <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                <span className="text-foreground">+{tool.diffPreview.addedLines} lines</span>
                <span className="text-destructive">-{tool.diffPreview.deletedLines} lines</span>
              </div>
            </div>
          )}

          {/* Approve / Reject Controls */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => approveTool(tool.id)}
              className="h-8 px-3 bg-primary text-primary-foreground hover:opacity-90 rounded-md text-xs font-medium flex items-center gap-1.5 transition-opacity"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Approve & Execute</span>
            </button>
            <button
              onClick={() => rejectTool(tool.id, 'User rejected the operation')}
              className="h-8 px-3 bg-muted hover:bg-destructive/20 text-muted-foreground hover:text-destructive border border-border rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Reject</span>
            </button>
          </div>
        </div>
      )}

      {/* Expanded details */}
      {isExpanded && (
        <div className="p-3 border-t border-border/40 space-y-2 bg-background">
          {/* Tool arguments */}
          <div>
            <div className="text-xs text-muted-foreground uppercase font-mono tracking-wider mb-1">
              Arguments
            </div>
            <pre className="p-2 bg-muted/40 border border-border rounded-md font-mono text-xs overflow-x-auto text-foreground">
              {JSON.stringify(tool.arguments, null, 2)}
            </pre>
          </div>

          {/* Diff Preview Quick Button */}
          {tool.diffPreview && (
            <div className="flex items-center justify-between p-2 bg-muted/30 border border-border rounded-md">
              <div className="font-mono text-xs">
                <span>Diff: </span>
                <span className="text-foreground font-semibold">{tool.diffPreview.relativePath}</span>
                <span className="ml-2 font-mono tabular-nums">+{tool.diffPreview.addedLines}</span>
                <span className="text-destructive ml-1 font-mono tabular-nums">-{tool.diffPreview.deletedLines}</span>
              </div>
              <button
                onClick={handleOpenDiff}
                className="h-7 px-2 bg-accent hover:bg-muted text-accent-foreground rounded-md text-xs flex items-center gap-1 font-mono transition-colors"
              >
                <span>Inspect Diff</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Execution Result / Output */}
          {tool.result && (
            <div>
              <div className="text-xs text-muted-foreground uppercase font-mono tracking-wider mb-1">
                Result
              </div>
              <pre className="p-2 bg-muted/40 border border-border rounded-md font-mono text-xs max-h-48 overflow-y-auto overflow-x-auto text-foreground whitespace-pre-wrap">
                {typeof tool.result === 'string'
                  ? tool.result
                  : JSON.stringify(tool.result, null, 2)}
              </pre>
            </div>
          )}

          {/* Error Message */}
          {tool.error && (
            <div>
              <div className="text-xs text-destructive uppercase font-mono tracking-wider mb-1">
                Error Output
              </div>
              <div className="p-2 bg-destructive/10 border border-destructive/30 rounded-md font-mono text-xs text-destructive whitespace-pre-wrap">
                {tool.error}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
