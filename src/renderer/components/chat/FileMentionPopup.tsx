import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { FileNode } from '../../../shared/types';
import { FileCode, FileText, File } from 'lucide-react';

interface FileMentionPopupProps {
  query: string;
  onSelect: (relativePath: string) => void;
  onClose: () => void;
}

function flattenFiles(nodes: FileNode[]): FileNode[] {
  let list: FileNode[] = [];
  for (const node of nodes) {
    if (!node.isDirectory) {
      list.push(node);
    }
    if (node.children) {
      list = list.concat(flattenFiles(node.children));
    }
  }
  return list;
}

export const FileMentionPopup: React.FC<FileMentionPopupProps> = ({
  query,
  onSelect,
  onClose,
}) => {
  const { fileTree } = useAppStore();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const allFiles = flattenFiles(fileTree);
  const filtered = allFiles
    .filter((f) => f.relativePath.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (filtered.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex].relativePath);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filtered, selectedIndex, onSelect, onClose]);

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full mb-2 left-3 w-80 bg-popover border border-border rounded-md shadow-sm overflow-hidden z-50 flex flex-col">
      <div className="px-2.5 py-1.5 bg-muted/50 border-b border-border text-xs font-mono text-muted-foreground flex items-center justify-between">
        <span>Mention File Context (@)</span>
        <span>↑↓ to navigate, Enter to select</span>
      </div>
      <div className="max-h-48 overflow-y-auto p-1 divide-y divide-border/20">
        {filtered.map((file, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <button
              key={file.path}
              onClick={() => onSelect(file.relativePath)}
              className={`w-full px-2 py-1.5 text-left flex items-center gap-2 rounded text-xs transition-colors ${
                isSelected
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-foreground hover:bg-accent/50'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div className="flex flex-col truncate min-w-0">
                <span className="font-mono text-xs truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground font-mono truncate">
                  {file.relativePath}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
