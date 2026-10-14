import React, { useState } from 'react';
import { useDiffStore } from '../../store/useDiffStore';
import { useAppStore } from '../../store/useAppStore';
import { DiffEditor } from '@monaco-editor/react';
import {
  Check,
  X,
  FileDiff,
  Columns,
  AlignLeft,
  XCircle,
  CheckCircle2,
} from 'lucide-react';

export const DiffViewer: React.FC = () => {
  const { currentDiff, setDiff } = useDiffStore();
  const { activeTools, approveTool, rejectTool } = useAppStore();
  const [sideBySide, setSideBySide] = useState(true);

  if (!currentDiff) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground gap-2">
        <FileDiff className="w-8 h-8 text-muted-foreground stroke-1" />
        <p className="text-xs font-mono text-foreground">No diff selected</p>
        <span className="text-xs max-w-xs text-muted-foreground">
          When the agent generates or refactors code using apply_diff or write_file,
          the interactive diff comparison will appear here.
        </span>
      </div>
    );
  }

  // Find if there is an active tool corresponding to this diff that is pending approval
  let pendingToolId: string | null = null;
  for (const [id, tool] of activeTools) {
    if (tool.status === 'pending_approval' && tool.diffPreview?.path === currentDiff.path) {
      pendingToolId = id;
      break;
    }
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Diff Top Bar */}
      <div className="h-9 px-3 border-b border-border bg-card flex items-center justify-between select-none shrink-0">
        <div className="flex items-center gap-2 font-mono text-xs truncate min-w-0">
          <FileDiff className="w-3.5 h-3.5 text-foreground shrink-0" />
          <span className="font-semibold text-foreground truncate">{currentDiff.relativePath}</span>
          <span className="text-foreground text-xs font-mono tabular-nums">+{currentDiff.addedLines}</span>
          <span className="text-destructive text-xs font-mono tabular-nums">-{currentDiff.deletedLines}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Side-by-Side vs Inline Toggle */}
          <button
            onClick={() => setSideBySide(!sideBySide)}
            className="h-6 px-2 flex items-center gap-1 rounded-sm bg-muted/60 hover:bg-muted text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
            title={sideBySide ? 'Switch to inline unified view' : 'Switch to side-by-side view'}
          >
            {sideBySide ? <Columns className="w-3 h-3" /> : <AlignLeft className="w-3 h-3" />}
            <span>{sideBySide ? 'Side-by-Side' : 'Unified'}</span>
          </button>

          {/* Close Diff Button */}
          <button
            onClick={() => setDiff(null)}
            className="h-6 w-6 flex items-center justify-center rounded-sm hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Close Diff"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Pending Approval Action Bar */}
      {pendingToolId && (
        <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between select-none shrink-0">
          <span className="text-xs font-medium text-foreground">
            Pending user review: Approve or reject these proposed modifications.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => pendingToolId && approveTool(pendingToolId)}
              className="h-8 px-3 bg-primary text-primary-foreground hover:opacity-90 rounded-md text-xs font-medium flex items-center gap-1.5 transition-opacity"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Approve Changes</span>
            </button>
            <button
              onClick={() => pendingToolId && rejectTool(pendingToolId, 'Rejected in Diff Viewer')}
              className="h-8 px-3 bg-muted hover:bg-destructive/20 text-muted-foreground hover:text-destructive border border-border rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Reject</span>
            </button>
          </div>
        </div>
      )}

      {/* Monaco Diff Editor */}
      <div className="flex-1 min-h-0">
        <DiffEditor
          original={currentDiff.originalContent}
          modified={currentDiff.newContent}
          theme="vs-dark"
          options={{
            readOnly: true,
            renderSideBySide: sideBySide,
            minimap: { enabled: false },
            fontSize: 12,
            fontFamily: "'JetBrains Mono', 'Geist Mono', monospace",
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'off',
            renderIndicators: true,
          }}
        />
      </div>
    </div>
  );
};
