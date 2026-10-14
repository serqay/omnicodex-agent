import React, { useState } from 'react';
import { FileNode } from '../../../shared/types';
import { useDiffStore } from '../../store/useDiffStore';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  File,
} from 'lucide-react';

interface FileTreeProps {
  nodes: FileNode[];
  searchQuery?: string;
  onMentionFile?: (relativePath: string) => void;
}

function getFileIcon(extension?: string) {
  switch (extension) {
    case '.ts':
    case '.tsx':
    case '.js':
    case '.jsx':
    case '.py':
    case '.rs':
    case '.go':
      return <FileCode className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
    case '.json':
      return <FileJson className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
    case '.md':
    case '.txt':
      return <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
    default:
      return <File className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
  }
}

const TreeNode: React.FC<{
  node: FileNode;
  depth: number;
  searchQuery?: string;
  onMentionFile?: (rel: string) => void;
}> = ({ node, depth, searchQuery, onMentionFile }) => {
  const [isOpen, setIsOpen] = useState(depth === 0 || !!searchQuery);
  const { openFile } = useDiffStore();

  const isMatching =
    !searchQuery ||
    node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    node.relativePath.toLowerCase().includes(searchQuery.toLowerCase());

  const handleFileClick = async () => {
    if (node.isDirectory) {
      setIsOpen(!isOpen);
    } else {
      if (window.api) {
        try {
          const res = await window.api.files.read(node.relativePath);
          openFile({
            path: node.path,
            relativePath: node.relativePath,
            content: res.rawContent,
            language: '',
          });
        } catch (err: any) {
          console.error('Failed to open file:', err);
        }
      }
    }
  };

  if (searchQuery && !isMatching && (!node.children || node.children.length === 0)) {
    return null;
  }

  return (
    <div>
      <div
        onClick={handleFileClick}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className="flex items-center gap-1.5 py-1 pr-2 hover:bg-accent/60 cursor-pointer rounded text-xs group text-foreground transition-colors"
        title={node.relativePath}
      >
        {node.isDirectory ? (
          <>
            <span className="text-muted-foreground p-0.5">
              {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </span>
            {isOpen ? (
              <FolderOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            )}
            <span className="truncate font-mono text-xs">{node.name}</span>
          </>
        ) : (
          <>
            <span className="w-4 shrink-0" />
            {getFileIcon(node.extension)}
            <span className="truncate font-mono text-xs group-hover:text-foreground">
              {node.name}
            </span>
            {onMentionFile && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMentionFile(node.relativePath);
                }}
                className="ml-auto opacity-0 group-hover:opacity-100 text-xs px-1 py-0.5 rounded bg-muted hover:bg-accent text-muted-foreground hover:text-foreground"
                title="Attach as @context to chat"
              >
                @
              </button>
            )}
          </>
        )}
      </div>

      {node.isDirectory && isOpen && node.children && (
        <div>
          {node.children.map((child: FileNode) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              searchQuery={searchQuery}
              onMentionFile={onMentionFile}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const FileTree: React.FC<FileTreeProps> = ({ nodes, searchQuery, onMentionFile }) => {
  if (nodes.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground">
        No files in workspace or folder is empty.
      </div>
    );
  }

  return (
    <div className="py-1">
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          searchQuery={searchQuery}
          onMentionFile={onMentionFile}
        />
      ))}
    </div>
  );
};
