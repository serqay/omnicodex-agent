import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { GitBranch, RefreshCw, FileDiff } from 'lucide-react';

export const GitStatusBadge: React.FC = () => {
  const { gitStatus, refreshGitStatus } = useAppStore();

  if (!gitStatus || !gitStatus.isGitRepo) {
    return (
      <div className="p-2 border-t border-border text-xs font-mono text-muted-foreground flex items-center justify-between">
        <span>No git repo detected</span>
        <button
          onClick={() => refreshGitStatus()}
          className="p-1 hover:text-foreground transition-colors"
          title="Refresh Git status"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const totalChanges = gitStatus.modified.length + gitStatus.staged.length + gitStatus.untracked.length;

  return (
    <div className="p-2 border-t border-border flex flex-col gap-1.5 bg-card">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-mono text-xs text-foreground">
          <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-semibold">{gitStatus.branch || 'detached'}</span>
        </div>
        <button
          onClick={() => refreshGitStatus()}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh Git status"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-2 text-xs font-mono">
        {gitStatus.staged.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-sm border border-border bg-muted text-foreground tabular-nums">
            +{gitStatus.staged.length} staged
          </span>
        )}
        {gitStatus.modified.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-sm border border-border bg-muted text-foreground tabular-nums">
            ~{gitStatus.modified.length} modified
          </span>
        )}
        {gitStatus.untracked.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-sm border border-border bg-muted text-muted-foreground tabular-nums">
            ?{gitStatus.untracked.length} untracked
          </span>
        )}
        {totalChanges === 0 && (
          <span className="text-muted-foreground">Clean</span>
        )}
      </div>
    </div>
  );
};
