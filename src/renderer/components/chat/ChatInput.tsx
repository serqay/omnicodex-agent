import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { FileMentionPopup } from './FileMentionPopup';
import { Send, Square, FileCode, X, CornerDownLeft } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (prompt: string, attachedFiles: string[]) => void;
  attachedFiles: string[];
  onRemoveAttachedFile: (file: string) => void;
  onAddAttachedFile: (file: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  attachedFiles,
  onRemoveAttachedFile,
  onAddAttachedFile,
}) => {
  const [prompt, setPrompt] = useState('');
  const [showMention, setShowMention] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isStreaming, cancelGeneration } = useAppStore();

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [prompt]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPrompt(val);

    // Check for @ mention trigger
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex !== -1 && (atIndex === 0 || /\s/.test(textBeforeCursor[atIndex - 1]))) {
      const query = textBeforeCursor.slice(atIndex + 1);
      if (!/\s/.test(query)) {
        setShowMention(true);
        setMentionQuery(query);
        return;
      }
    }
    setShowMention(false);
  };

  const handleSelectMention = (fileRelPath: string) => {
    onAddAttachedFile(fileRelPath);
    if (textareaRef.current) {
      const cursorPos = textareaRef.current.selectionStart;
      const textBeforeCursor = prompt.slice(0, cursorPos);
      const atIndex = textBeforeCursor.lastIndexOf('@');
      const textAfterCursor = prompt.slice(cursorPos);

      const newPrompt = `${prompt.slice(0, atIndex)}@${fileRelPath} ${textAfterCursor}`;
      setPrompt(newPrompt);
    }
    setShowMention(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMention) return; // Allow popup to handle arrow keys

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!prompt.trim() || isStreaming) return;
    onSendMessage(prompt.trim(), attachedFiles);
    setPrompt('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <div className="relative p-3 border-t border-border bg-card">
      {/* File Mention Popup */}
      {showMention && (
        <FileMentionPopup
          query={mentionQuery}
          onSelect={handleSelectMention}
          onClose={() => setShowMention(false)}
        />
      )}

      {/* Attached Files Chips */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2 select-none">
          {attachedFiles.map((f) => (
            <div
              key={f}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-muted/80 border border-border text-xs font-mono text-foreground"
            >
              <FileCode className="w-3 h-3 text-muted-foreground" />
              <span className="truncate max-w-xs">{f}</span>
              <button
                onClick={() => onRemoveAttachedFile(f)}
                className="text-muted-foreground hover:text-foreground ml-1"
                title="Remove attachment"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Textarea container */}
      <div className="flex items-end gap-2 bg-background border border-input rounded-md px-3 py-2 focus-within:ring-1 focus-within:ring-ring focus-within:border-ring transition-all">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask Claude Code & Codex to build, edit, or test something... (Type @ to attach files)"
          rows={1}
          className="flex-1 bg-transparent border-0 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none max-h-44 leading-relaxed font-sans"
        />

        {isStreaming ? (
          <button
            onClick={() => cancelGeneration()}
            className="h-8 px-2.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded flex items-center gap-1.5 text-xs font-medium transition-colors shrink-0"
            title="Cancel generation"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Stop</span>
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!prompt.trim()}
            className="h-8 w-8 bg-primary hover:opacity-90 disabled:opacity-40 disabled:hover:opacity-40 text-primary-foreground rounded flex items-center justify-center transition-all shrink-0"
            title="Send prompt (Enter)"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground select-none">
        <div className="flex items-center gap-1">
          <span>Type</span>
          <kbd className="px-1 py-0.5 bg-muted border border-border rounded font-mono">@</kbd>
          <span>to attach files</span>
        </div>
        <div className="flex items-center gap-1">
          <span>Press</span>
          <kbd className="px-1 py-0.5 bg-muted border border-border rounded font-mono">Enter</kbd>
          <span>to send</span>
        </div>
      </div>
    </div>
  );
};
