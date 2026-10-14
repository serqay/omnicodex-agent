import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ChevronDown, RefreshCw, Cpu, Search, Check, Plus } from 'lucide-react';

export const ModelSelector: React.FC = () => {
  const { config, models, isLoadingModels, fetchModels, saveConfig } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState(config.customModelId || '');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeModelId = config.customModelId.trim() || config.selectedModel;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredModels = models.filter((m) =>
    m.id.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectModel = async (modelId: string) => {
    await saveConfig({ selectedModel: modelId, customModelId: '' });
    setIsOpen(false);
  };

  const handleSaveCustom = async () => {
    if (customInput.trim()) {
      await saveConfig({ customModelId: customInput.trim() });
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 px-2.5 flex items-center gap-2 bg-card hover:bg-accent border border-border rounded-md text-xs font-medium text-foreground transition-colors"
        title="Select AI Model"
      >
        <span
          className={`w-2 h-2 rounded-full ${
            models.length > 0 ? 'bg-primary' : config.apiKey ? 'bg-muted-foreground' : 'bg-muted'
          }`}
        />
        <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="font-mono text-xs max-w-44 truncate">{activeModelId}</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1.5 left-0 w-80 bg-popover border border-border rounded-md shadow-sm z-50 overflow-hidden flex flex-col">
          {/* Search & Actions Header */}
          <div className="p-2 border-b border-border flex items-center gap-1.5 bg-muted/40">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search OmniRouter models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-0 text-xs w-full text-foreground placeholder:text-muted-foreground focus:outline-none"
              autoFocus
            />
            <button
              onClick={() => fetchModels()}
              disabled={isLoadingModels}
              className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh models from OmniRouter"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingModels ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Model List */}
          <div className="max-h-60 overflow-y-auto p-1 divide-y divide-border/20">
            {filteredModels.length > 0 ? (
              filteredModels.map((m) => {
                const isSelected = activeModelId === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => handleSelectModel(m.id)}
                    className={`w-full px-2.5 py-1.5 text-left flex items-center justify-between rounded text-xs transition-colors ${
                      isSelected
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'text-foreground hover:bg-accent/60'
                    }`}
                  >
                    <div className="flex flex-col truncate pr-2">
                      <span className="font-mono truncate">{m.id}</span>
                      {m.context_length && (
                        <span className="text-xs text-muted-foreground font-mono tabular-nums">
                          ctx: {m.context_length.toLocaleString()}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-foreground shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="p-3 text-center text-xs text-muted-foreground">
                {models.length === 0
                  ? 'No models loaded. Check OmniRouter settings or click refresh.'
                  : 'No matching models found.'}
              </div>
            )}
          </div>

          {/* Custom Model Footer */}
          <div className="p-2 border-t border-border bg-muted/30">
            {isCustomMode ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="e.g. meta-llama/llama-3.3-70b"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  className="bg-background border border-input rounded px-2 py-1 text-xs font-mono text-foreground flex-1 focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  onClick={handleSaveCustom}
                  className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90"
                >
                  Use
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsCustomMode(true)}
                className="w-full text-left flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Enter custom model ID...</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
