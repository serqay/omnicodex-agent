import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { FileTree } from './FileTree';
import { SessionList } from './SessionList';
import { GitStatusBadge } from './GitStatusBadge';
import { FolderTree, History, Search, RefreshCw, FolderOpen } from 'lucide-react';

interface SidebarProps {
  onMentionFile?: (relativePath: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onMentionFile }) => {
  const [activeTab, setActiveTab] = useState<'files' | 'history'>('files');
  const [searchQuery, setSearchQuery] = useState('');
  const { fileTree, refreshFileTree, workspacePath, openWorkspaceDialog } = useAppStore();

  return (
    <aside className="w-64 border-r border-border bg-card flex flex-col h-full select-none shrink-0 overflow-hidden">
      {/* Sidebar Navigation Tabs */}
      <div className="h-9 border-b border-border flex items-center px-2 gap-1 bg-muted/30">
        <button
          onClick={() => setActiveTab('files')}
          className={`flex-1 h-7 flex items-center justify-center gap-1.5 rounded text-xs font-medium transition-colors ${
            activeTab === 'files'
              ? 'bg-background text-foreground border border-border shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FolderTree className="w-3.5 h-3.5" />
          <span>Files</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 h-7 flex items-center justify-center gap-1.5 rounded text-xs font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-background text-foreground border border-border shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>History</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {activeTab === 'files' ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Search Files Bar */}
            <div className="p-2 border-b border-border flex items-center gap-1.5 bg-card">
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Filter files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-0 text-xs w-full text-foreground placeholder:text-muted-foreground focus:outline-none font-mono"
              />
              <button
                onClick={() => refreshFileTree()}
                className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
                title="Refresh File Tree"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            {/* Tree View */}
            <div className="flex-1 overflow-y-auto">
              {workspacePath ? (
                <FileTree
                  nodes={fileTree}
                  searchQuery={searchQuery}
                  onMentionFile={onMentionFile}
                />
              ) : (
                <div className="p-4 flex flex-col items-center justify-center h-full text-center gap-3">
                  <p className="text-xs text-muted-foreground">No workspace folder open.</p>
                  <button
                    onClick={openWorkspaceDialog}
                    className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Open Folder</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <SessionList />
        )}
      </div>

      {/* Git Footer */}
      <GitStatusBadge />
    </aside>
  );
};
