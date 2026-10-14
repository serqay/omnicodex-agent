import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { useDiffStore } from '../../store/useDiffStore';
import { FileCode, Save, X, Check } from 'lucide-react';

export const CodeEditor: React.FC = () => {
  const { currentFile, closeFile } = useDiffStore();
  const [content, setContent] = useState(currentFile?.content || '');
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    if (currentFile) {
      setContent(currentFile.content);
      setIsSaved(false);
    }
  }, [currentFile]);

  if (!currentFile) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground gap-2">
        <FileCode className="w-8 h-8 text-muted-foreground stroke-1" />
        <p className="text-xs font-mono">No file open</p>
        <span className="text-xs max-w-xs text-muted-foreground">
          Click any file in the workspace file tree to inspect or edit its contents.
        </span>
      </div>
    );
  }

  const handleSave = async () => {
    if (!window.api || isSaving) return;
    setIsSaving(true);
    try {
      await window.api.files.write(currentFile.relativePath, content);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save file:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Editor Header */}
      <div className="h-9 px-3 border-b border-border bg-card flex items-center justify-between select-none shrink-0">
        <div className="flex items-center gap-2 font-mono text-xs text-foreground truncate min-w-0">
          <FileCode className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="font-semibold truncate">{currentFile.relativePath}</span>
          <span className="text-xs text-muted-foreground font-mono">
            ({currentFile.language || 'text'})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="h-6 px-2 flex items-center gap-1 rounded bg-muted/60 hover:bg-muted text-xs font-mono text-foreground transition-colors"
            title="Save file (Ctrl+S)"
          >
            {isSaved ? (
              <>
                <Check className="w-3 h-3 text-foreground" />
                <span className="text-foreground font-medium">Saved</span>
              </>
            ) : (
              <>
                <Save className="w-3 h-3" />
                <span>Save</span>
              </>
            )}
          </button>

          <button
            onClick={closeFile}
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Close File"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Monaco Editor Container */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={currentFile.language}
          value={content}
          onChange={(val) => setContent(val || '')}
          theme="vs-dark"
          options={{
            fontSize: 12,
            fontFamily: "'JetBrains Mono', 'Geist Mono', monospace",
            minimap: { enabled: true },
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
          }}
        />
      </div>
    </div>
  );
};
