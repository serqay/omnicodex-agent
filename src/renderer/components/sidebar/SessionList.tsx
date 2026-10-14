import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { formatTimeAgo } from '../../utils/formatters';
import { Plus, MessageSquare, Trash2 } from 'lucide-react';

export const SessionList: React.FC = () => {
  const { sessions, activeSessionId, switchSession, createSession, deleteSession } =
    useAppStore();

  return (
    <div className="flex flex-col h-full">
      {/* New Task Button */}
      <div className="p-2 border-b border-border">
        <button
          onClick={() => createSession()}
          className="w-full h-8 px-3 flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:opacity-90 rounded-md text-xs font-medium transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Task</span>
        </button>
      </div>

      {/* Sessions Scroll List */}
      <div className="flex-1 overflow-y-auto p-1 divide-y divide-border/10">
        {sessions.map((sess) => {
          const isActive = sess.id === activeSessionId;
          const msgCount = sess.messages.length;

          return (
            <div
              key={sess.id}
              onClick={() => switchSession(sess.id)}
              className={`group flex items-center justify-between px-2.5 py-2 cursor-pointer rounded text-xs transition-colors ${
                isActive
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <MessageSquare className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                <div className="flex flex-col min-w-0">
                  <span className="truncate text-xs font-normal text-foreground">
                    {sess.title || 'Untitled Task'}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {formatTimeAgo(sess.updatedAt)} • {msgCount} msg{msgCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSession(sess.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 hover:text-destructive rounded transition-opacity"
                title="Delete session"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
