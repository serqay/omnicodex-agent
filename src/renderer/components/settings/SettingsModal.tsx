import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { DEFAULT_SYSTEM_PROMPT } from '../../../shared/defaultPrompt';
import {
  X,
  Key,
  Globe,
  Cpu,
  Shield,
  Sliders,
  FileText,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';

export const SettingsModal: React.FC = () => {
  const {
    config,
    saveConfig,
    isSettingsOpen,
    setSettingsOpen,
    models,
    fetchModels,
    isLoadingModels,
  } = useAppStore();

  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [selectedModel, setSelectedModel] = useState(config.selectedModel);
  const [customModelId, setCustomModelId] = useState(config.customModelId);
  const [temperature, setTemperature] = useState(config.temperature);
  const [maxTokens, setMaxTokens] = useState(config.maxTokens);
  const [safeMode, setSafeMode] = useState(config.safeMode);
  const [systemPrompt, setSystemPrompt] = useState(config.systemPrompt || DEFAULT_SYSTEM_PROMPT);

  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  if (!isSettingsOpen) return null;

  const handleTestConnection = async () => {
    if (!window.api) return;
    setIsTesting(true);
    setTestStatus(null);
    try {
      const res = await window.api.omnirouter.testConnection(baseUrl, apiKey);
      setTestStatus({
        tested: true,
        success: res.success,
        message: res.message,
      });
      if (res.success) {
        fetchModels();
      }
    } catch (err: any) {
      setTestStatus({
        tested: true,
        success: false,
        message: err.message || 'Connection test failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    await saveConfig({
      baseUrl,
      apiKey,
      selectedModel,
      customModelId,
      temperature,
      maxTokens,
      safeMode,
      systemPrompt,
    });
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      setSettingsOpen(false);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-2xl bg-card border border-border rounded-lg shadow-sm flex flex-col max-h-full overflow-hidden">
        {/* Header */}
        <div className="h-12 px-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground">Settings</span>
            <span className="text-xs font-mono text-muted-foreground">
              OmniRouter & Agent Configuration
            </span>
          </div>
          <button
            onClick={() => setSettingsOpen(false)}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* Section: OmniRouter Connection */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
              <Globe className="w-3.5 h-3.5" />
              <span>OmniRouter API Connection</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-foreground font-medium">Base URL</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.omnirouter.ai/v1"
                className="w-full h-8 px-2.5 bg-background border border-input rounded text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <span className="text-xs text-muted-foreground">
                Compatible with OpenAI-standard endpoints (/v1/chat/completions, /v1/models).
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-foreground font-medium">API Key</label>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-or-..."
                    className="w-full h-8 pl-2.5 pr-8 bg-background border border-input rounded text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="h-8 px-3 bg-muted hover:bg-accent border border-border rounded font-medium text-foreground transition-colors shrink-0 flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>Test Connection</span>
                </button>
              </div>

              {testStatus && (
                <div
                  className={`p-2 rounded border font-mono text-xs flex items-center gap-1.5 ${
                    testStatus.success
                      ? 'bg-muted text-foreground border-border'
                      : 'bg-destructive/10 text-destructive border-destructive/30'
                  }`}
                >
                  {testStatus.success ? (
                    <Check className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{testStatus.message}</span>
                </div>
              )}
            </div>
          </div>

          <hr className="border-border" />

          {/* Section: Model Configuration */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
              <Cpu className="w-3.5 h-3.5" />
              <span>Model Selection</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-foreground font-medium">Default Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full h-8 px-2 bg-background border border-input rounded text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id}
                    </option>
                  ))}
                  {!models.some((m) => m.id === selectedModel) && (
                    <option value={selectedModel}>{selectedModel}</option>
                  )}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-foreground font-medium">Custom Model ID (Override)</label>
                <input
                  type="text"
                  value={customModelId}
                  onChange={(e) => setCustomModelId(e.target.value)}
                  placeholder="Optional custom router ID..."
                  className="w-full h-8 px-2.5 bg-background border border-input rounded text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className="text-foreground font-medium">Temperature</label>
                  <span className="font-mono text-muted-foreground">{temperature}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-foreground font-medium">Max Tokens</label>
                <input
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 4096)}
                  className="w-full h-8 px-2.5 bg-background border border-input rounded text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          </div>

          <hr className="border-border" />

          {/* Section: Safety Modes */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
              <Shield className="w-3.5 h-3.5" />
              <span>Safety & Execution Protocol</span>
            </div>

            <div className="p-3 bg-muted/20 border border-border rounded flex items-center justify-between">
              <div>
                <div className="font-medium text-foreground">Human-in-the-Loop Safe Mode</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  When enabled, agent asks for interactive user confirmation before modifying files
                  or executing shell commands.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSafeMode(!safeMode)}
                className={`w-11 h-6 rounded-md transition-colors relative flex items-center p-0.5 border border-border ${
                  safeMode ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-sm transition-transform ${
                    safeMode ? 'translate-x-5 bg-primary-foreground' : 'translate-x-0 bg-muted-foreground'
                  }`}
                />
              </button>
            </div>
          </div>

          <hr className="border-border" />

          {/* Section: System Prompt */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                <FileText className="w-3.5 h-3.5" />
                <span>Agent System Prompt</span>
              </div>
              <button
                type="button"
                onClick={() => setSystemPrompt(DEFAULT_SYSTEM_PROMPT)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Default</span>
              </button>
            </div>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={6}
              className="w-full p-2.5 bg-background border border-input rounded text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y leading-relaxed"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="h-12 px-4 border-t border-border bg-card flex items-center justify-end gap-2">
          <button
            onClick={() => setSettingsOpen(false)}
            className="h-8 px-3 rounded hover:bg-accent text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="h-8 px-4 bg-primary text-primary-foreground hover:opacity-90 rounded text-xs font-medium flex items-center gap-1.5 transition-opacity"
          >
            {isSaved ? <Check className="w-3.5 h-3.5" /> : null}
            <span>{isSaved ? 'Saved!' : 'Save Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
