import React, { useState } from 'react';
import { ChatMessage as ChatMessageType, ToolCall } from '../../../shared/types';
import { ReasoningBlock } from './ReasoningBlock';
import { ToolCallCard } from './ToolCallCard';
import { useDiffStore } from '../../store/useDiffStore';
import {
  User,
  Bot,
  Copy,
  Check,
  FileCode,
  Coins,
  FileDiff,
} from 'lucide-react';

interface ChatMessageProps {
  message: ChatMessageType;
  activeTools?: Map<string, ToolCall>;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, activeTools }) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Do not render internal tool or system messages as standalone chat bubbles
  if (message.role === 'tool' || message.role === 'system') {
    return null;
  }

  const isUser = message.role === 'user';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Render markdown code blocks nicely
  const renderFormattedContent = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        const lang = lines[0].trim();
        const code = lines.slice(lang ? 1 : 0).join('\n');

        return (
          <div
            key={index}
            className="my-3 rounded-md border border-border bg-card overflow-hidden font-mono text-xs"
          >
            <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border text-muted-foreground select-none">
              <span className="text-xs uppercase font-mono font-medium text-muted-foreground">
                {lang || 'code'}
              </span>
              <button
                onClick={() => copyToClipboard(code)}
                className="flex items-center gap-1 text-xs font-mono hover:text-foreground transition-colors"
                title="Copy code"
              >
                {copiedCode === code ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-foreground" />
                    <span className="text-foreground">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 overflow-x-auto text-foreground leading-relaxed whitespace-pre font-mono text-xs">
              <code>{code}</code>
            </pre>
          </div>
        );
      }

      // Format inline text
      return (
        <span key={index} className="whitespace-pre-wrap leading-relaxed">
          {part}
        </span>
      );
    });
  };

  // Merge toolCalls with activeTools (for real-time status updates)
  const resolvedToolCalls = message.toolCalls?.map((tc: ToolCall) => {
    return activeTools?.get(tc.id) || tc;
  });

  return (
    <div
      className={`py-3 px-4 flex gap-3 text-sm ${
        isUser ? 'bg-muted/30 border-b border-border' : 'bg-transparent border-b border-border'
      }`}
    >
      {/* Avatar */}
      <div className="shrink-0 mt-0.5 select-none">
        {isUser ? (
          <div className="w-6 h-6 rounded-md bg-muted text-foreground flex items-center justify-center border border-border">
            <User className="w-3.5 h-3.5" />
          </div>
        ) : (
          <div className="w-6 h-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-mono font-bold text-xs">
            Ω
          </div>
        )}
      </div>

      {/* Message Body */}
      <div className="flex-1 min-w-0">
        {/* Header (Role & Timestamp) */}
        <div className="flex items-center justify-between mb-1 select-none">
          <div className="flex items-center gap-2">
            <span className="font-medium text-xs text-foreground">
              {isUser ? 'You' : 'OmniCodex'}
            </span>
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          {message.tokenUsage && (
            <div
              className="flex items-center gap-1 text-xs font-mono text-muted-foreground tabular-nums"
              title={`Prompt: ${message.tokenUsage.promptTokens} | Completion: ${message.tokenUsage.completionTokens}`}
            >
              <Coins className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{message.tokenUsage.totalTokens.toLocaleString()} tokens</span>
            </div>
          )}
        </div>

        {/* Attached Context Files */}
        {message.attachedFiles && message.attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 my-1.5">
            {message.attachedFiles.map((file: string) => (
              <span
                key={file}
                className="flex items-center gap-1 px-2 py-0.5 rounded-sm bg-muted border border-border text-xs font-mono text-muted-foreground"
              >
                <FileCode className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{file}</span>
              </span>
            ))}
          </div>
        )}

        {/* Reasoning Block (<think> / reasoning_content) */}
        {message.reasoningContent && (
          <ReasoningBlock content={message.reasoningContent} />
        )}

        {/* Main Content */}
        {message.content && (
          <div className="text-foreground text-xs leading-relaxed font-sans select-text">
            {renderFormattedContent(message.content)}
          </div>
        )}

        {/* Tool Calls Cards */}
        {resolvedToolCalls && resolvedToolCalls.length > 0 && (
          <div className="mt-2 space-y-2">
            {resolvedToolCalls.map((tool: ToolCall) => (
              <ToolCallCard key={tool.id} tool={tool} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
