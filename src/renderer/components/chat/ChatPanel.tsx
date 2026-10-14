import React, { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ReasoningBlock } from './ReasoningBlock';
import { ToolCallCard } from './ToolCallCard';
import {
  Sparkles,
  Terminal,
  FileCode,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
  Plus,
} from 'lucide-react';

export const ChatPanel: React.FC = () => {
  const {
    activeSession,
    isStreaming,
    streamingText,
    streamingReasoning,
    activeTools,
    sendMessage,
    createSession,
    deleteSession,
  } = useAppStore();

  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeSession?.messages, streamingText, streamingReasoning, activeTools]);

  const handleAddAttachedFile = (file: string) => {
    if (!attachedFiles.includes(file)) {
      setAttachedFiles([...attachedFiles, file]);
    }
  };

  const handleRemoveAttachedFile = (file: string) => {
    setAttachedFiles(attachedFiles.filter((f) => f !== file));
  };

  const handleSendMessage = (prompt: string, files: string[]) => {
    sendMessage(prompt, files);
    setAttachedFiles([]);
  };

  const handleQuickPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background min-w-0 overflow-hidden">
      {/* Session Header */}
      <div className="h-9 border-b border-border bg-card px-4 flex items-center justify-between select-none shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-xs text-foreground truncate max-w-xs">
            {activeSession?.title || 'Active Task'}
          </span>
          {isStreaming ? (
            <span className="flex items-center gap-1 text-xs font-mono text-foreground bg-muted px-2 py-0.5 rounded-sm border border-border">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Generating...</span>
            </span>
          ) : (
            <span className="text-xs font-mono tabular-nums text-muted-foreground">
              {activeSession?.messages.length || 0} messages
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => createSession()}
            className="h-6 px-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-sm transition-colors"
            title="Start New Session"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {!activeSession || activeSession.messages.length === 0 ? (
          <div className="p-8 max-w-xl mx-auto flex flex-col items-start justify-center h-full gap-4 text-left">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                OmniCodex Agent
              </h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Autonomous AI software architect directly connected to your local filesystem,
                compiler, and terminal via OmniRouter.
              </p>
            </div>

            {/* Quick Action Prompts */}
            <div className="w-full grid grid-cols-1 gap-2 pt-2">
              <button
                onClick={() =>
                  handleQuickPrompt('Inspect the workspace structure and describe key modules.')
                }
                className="p-2.5 rounded-md border border-border bg-card hover:bg-accent/60 text-left transition-colors flex items-center justify-between group"
              >
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-foreground">
                    Inspect Workspace Architecture
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    Scans files, packages, and project configuration
                  </span>
                </div>
                <FileCode className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0" />
              </button>

              <button
                onClick={() =>
                  handleQuickPrompt('Run git status, review changes, and verify test suite.')
                }
                className="p-2.5 rounded-md border border-border bg-card hover:bg-accent/60 text-left transition-colors flex items-center justify-between group"
              >
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-foreground">
                    Verify Git Status & Run Tests
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    Executes terminal checks and reports status
                  </span>
                </div>
                <Terminal className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0" />
              </button>
            </div>
          </div>
        ) : (
          <div>
            {activeSession.messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} activeTools={activeTools} />
            ))}

            {/* Active Streaming Chunk Display */}
            {isStreaming && (streamingText || streamingReasoning) && (
              <div className="py-3 px-4 flex gap-3 text-sm bg-transparent border-b border-border/40 animate-subtle-pulse">
                <div className="shrink-0 mt-0.5 select-none">
                  <div className="w-6 h-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-mono font-bold text-xs">
                    Ω
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 select-none">
                    <span className="font-medium text-xs text-foreground">OmniCodex</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  </div>

                  {streamingReasoning && (
                    <ReasoningBlock content={streamingReasoning} isStreaming={true} />
                  )}

                  {streamingText && (
                    <div className="text-foreground text-xs leading-relaxed font-sans whitespace-pre-wrap">
                      {streamingText}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <ChatInput
        onSendMessage={handleSendMessage}
        attachedFiles={attachedFiles}
        onRemoveAttachedFile={handleRemoveAttachedFile}
        onAddAttachedFile={handleAddAttachedFile}
      />
    </div>
  );
};
