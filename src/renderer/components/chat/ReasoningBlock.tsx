import React, { useState } from 'react';
import { ChevronDown, ChevronRight, BrainCircuit } from 'lucide-react';

interface ReasoningBlockProps {
  content: string;
  isStreaming?: boolean;
}

export const ReasoningBlock: React.FC<ReasoningBlockProps> = ({ content, isStreaming }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!content) return null;

  return (
    <div className="my-2 border border-border/80 rounded-md bg-muted/20 overflow-hidden text-xs">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-1.5 flex items-center justify-between bg-muted/40 hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground select-none"
      >
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <BrainCircuit className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-medium text-foreground">Thinking Process</span>
          {isStreaming && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse ml-1" />
          )}
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </div>
      </button>

      {isExpanded && (
        <div className="p-3 font-mono text-xs leading-relaxed text-foreground/80 bg-background/50 border-t border-border/40 whitespace-pre-wrap max-h-80 overflow-y-auto selection:bg-accent">
          {content}
        </div>
      )}
    </div>
  );
};
