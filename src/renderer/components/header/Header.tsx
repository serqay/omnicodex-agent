import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ModelSelector } from './ModelSelector';
import {
  FolderOpen,
  GitBranch,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Terminal,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    workspacePath,
    openWorkspaceDialog,
    gitStatus,
    config,
    toggleSafeMode,
    setSettingsOpen,
    omniRouteStatus,
    isStartingOmniRoute,
    startOmniRoute,
    openOmniRouteDashboard,
  } = useAppStore();

  const folderName = workspacePath ? workspacePath.split(/[\\/]/).pop() || workspacePath : 'Select Folder';

  return (
    <header className="h-11 border-b border-border bg-card px-3 flex items-center justify-between select-none shrink-0 z-20">
      {/* Left: App Brand & Workspace Picker */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 pr-2 border-r border-border">
          <div className="w-5 h-5 rounded-sm bg-primary text-primary-foreground flex items-center justify-center font-mono font-bold text-xs">
            Ω
          </div>
          <span className="font-semibold text-xs tracking-tight text-foreground">
            OmniCodex
          </span>
        </div>

        {/* Workspace Open Folder Button */}
        <button
          onClick={openWorkspaceDialog}
          className="h-7 px-2 flex items-center gap-1.5 bg-muted/60 hover:bg-muted border border-border rounded-md text-xs text-foreground transition-colors max-w-xs"
          title={workspacePath ? `Workspace: ${workspacePath}` : 'Open Folder'}
        >
          <FolderOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="truncate font-mono text-xs">{folderName}</span>
        </button>

        {/* Git Branch Badge */}
        {gitStatus?.isGitRepo && (
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-sm border border-border text-xs font-mono text-muted-foreground bg-muted/30"
            title={`Git Branch: ${gitStatus.branch || 'detached'}`}
          >
            <GitBranch className="w-3 h-3 text-muted-foreground" />
            <span className="max-w-28 truncate">{gitStatus.branch || 'git'}</span>
            {(gitStatus.modified.length > 0 || gitStatus.untracked.length > 0) && (
              <span className="text-foreground font-mono font-semibold ml-1">
                •{gitStatus.modified.length + gitStatus.untracked.length}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right: Controls & Modes */}
      <div className="flex items-center gap-2">
        {/* OmniRoute Status Badge & Action */}
        <div
          className="flex items-center gap-1.5 px-2.5 h-8 rounded-md border border-border text-xs font-mono bg-muted/20"
          title={
            omniRouteStatus?.isRunning
              ? `OmniRoute running on port ${omniRouteStatus.port}. Click Dashboard to manage models and providers.`
              : isStartingOmniRoute
              ? 'Starting local OmniRoute daemon...'
              : 'OmniRoute daemon is offline.'
          }
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              omniRouteStatus?.isRunning
                ? 'bg-emerald-500'
                : isStartingOmniRoute
                ? 'bg-amber-500 animate-pulse'
                : 'bg-muted-foreground'
            }`}
          />
          <span className="text-muted-foreground">OmniRoute:</span>
          <span className="font-semibold text-foreground">
            {omniRouteStatus?.isRunning ? 'online' : isStartingOmniRoute ? 'booting...' : 'offline'}
          </span>
          {omniRouteStatus?.isRunning ? (
            <button
              onClick={() => openOmniRouteDashboard()}
              className="ml-1 text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors cursor-pointer"
            >
              Dashboard
            </button>
          ) : (
            <button
              onClick={() => startOmniRoute()}
              disabled={isStartingOmniRoute}
              className="ml-1 text-foreground underline underline-offset-2 hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-50"
            >
              Start
            </button>
          )}
        </div>

        {/* Model Selector */}
        <ModelSelector />

        {/* Safety Mode Toggle */}
        <button
          onClick={toggleSafeMode}
          className={`h-8 px-2.5 flex items-center gap-1.5 rounded-md text-xs font-medium border transition-colors ${
            config.safeMode
              ? 'border-border bg-muted/40 hover:bg-accent text-foreground'
              : 'border-primary/40 bg-primary/10 hover:bg-primary/20 text-foreground'
          }`}
          title={
            config.safeMode
              ? 'Safe Mode: Requires confirmation before editing files or running commands.'
              : 'Auto-Pilot (YOLO Mode): Allows autonomous code editing and command execution.'
          }
        >
          {config.safeMode ? (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-foreground" />
              <span>Safe Mode</span>
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5 text-foreground" />
              <span>Auto-Pilot (YOLO)</span>
            </>
          )}
        </button>

        {/* Settings Button */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="h-8 w-8 flex items-center justify-center bg-card hover:bg-accent border border-border rounded-md text-muted-foreground hover:text-foreground transition-colors"
          title="Open Settings (OmniRouter API, Models, System Prompt)"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
