import React from 'react';
import { useDiffStore, RightPanelTab } from '../../store/useDiffStore';
import { DiffViewer } from './DiffViewer';
import { TerminalView } from './TerminalView';
import { CodeEditor } from './CodeEditor';
import { FileDiff, Terminal, FileCode } from 'lucide-react';

export const RightPanel: React.FC = () => {
  const { activeTab, setActiveTab, currentDiff, currentFile } = useDiffStore();

  return (
    <div className="w-1/2 min-w-96 max-w-2xl border-l border-border bg-card flex flex-col h-full select-none shrink-0 overflow-hidden">
      {/* Tabs Switcher Header */}
      <div className="h-9 border-b border-border flex items-center px-2 gap-1 bg-muted/30 select-none shrink-0">
        <button
          onClick={() => setActiveTab('diff')}
          className={`h-7 px-3 flex items-center gap-1.5 rounded text-xs font-medium transition-colors ${
            activeTab === 'diff'
              ? 'bg-background text-foreground border border-border shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileDiff className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Diff Viewer</span>
          {currentDiff && <span className="w-1.5 h-1.5 rounded-full bg-primary ml-0.5" />}
        </button>

        <button
          onClick={() => setActiveTab('terminal')}
          className={`h-7 px-3 flex items-center gap-1.5 rounded text-xs font-medium transition-colors ${
            activeTab === 'terminal'
              ? 'bg-background text-foreground border border-border shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Terminal</span>
        </button>

        <button
          onClick={() => setActiveTab('editor')}
          className={`h-7 px-3 flex items-center gap-1.5 rounded text-xs font-medium transition-colors ${
            activeTab === 'editor'
              ? 'bg-background text-foreground border border-border shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileCode className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Editor</span>
          {currentFile && (
            <span className="text-xs text-muted-foreground font-mono max-w-20 truncate">
              ({currentFile.relativePath.split('/').pop()})
            </span>
          )}
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'diff' && <DiffViewer />}
        {activeTab === 'terminal' && <TerminalView />}
        {activeTab === 'editor' && <CodeEditor />}
      </div>
    </div>
  );
};
