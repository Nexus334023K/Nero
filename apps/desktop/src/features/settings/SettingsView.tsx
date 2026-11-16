import { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { api, type ProviderItem } from '../../services/api';
import type { PersonalityMode } from '../../types';

interface ProviderCardConfigProps {
  id: string;
  name: string;
  type: 'Cloud / API' | 'Local / Offline' | 'Local Built-in';
  description: string;
  isActive: boolean;
  isConfigured: boolean;
  models?: string[];
  defaultModel?: string;
  defaultBaseUrl?: string;
  hasApiKey?: boolean;
  onSave: (config: { apiKey?: string; model?: string; baseUrl?: string; isActive: boolean }) => Promise<void>;
  onTest: () => Promise<{ success: boolean; latency_ms?: number; message?: string }>;
}

function ProviderConfigCard({
  name,
  type,
  description,
  isActive,
  isConfigured,
  models,
  defaultModel,
  defaultBaseUrl,
  hasApiKey = true,
  onSave,
  onTest,
}: ProviderCardConfigProps) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(defaultModel || (models ? models[0] : ''));
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl || '');
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; text: string } | null>(null);

  useEffect(() => {
    if (defaultModel) setModel(defaultModel);
  }, [defaultModel]);

  useEffect(() => {
    if (defaultBaseUrl) setBaseUrl(defaultBaseUrl);
  }, [defaultBaseUrl]);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await onTest();
      if (res.success) {
        setTestResult({
          success: true,
          text: `Online (${res.latency_ms ?? 120}ms)`,
        });
      } else {
        setTestResult({
          success: false,
          text: res.message || 'Connection failed',
        });
      }
    } catch {
      setTestResult({ success: false, text: 'Network unreachable' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (activate = false) => {
    setIsSaving(true);
    try {
      await onSave({
        apiKey: apiKey.trim() || undefined,
        model: model.trim() || undefined,
        baseUrl: baseUrl.trim() || undefined,
        isActive: activate,
      });
      setTestResult({ success: true, text: activate ? 'Activated & Saved' : 'Saved' });
    } catch {
      setTestResult({ success: false, text: 'Save failed' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={`glass rounded-xl p-5 flex flex-col justify-between border transition-all ${
        isActive
          ? 'border-nero-cyan/60 bg-nero-cyan/5 cyan-glow-sm'
          : 'border-white/10 hover:border-white/20'
      }`}
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm text-nero-text">{name}</h4>
            {isActive && (
              <span className="text-[9px] font-mono uppercase bg-nero-cyan/20 text-nero-cyan px-2 py-0.5 rounded-full border border-nero-cyan/30">
                ACTIVE
              </span>
            )}
          </div>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
              isConfigured
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-white/5 text-nero-muted border-white/10'
            }`}
          >
            {isConfigured ? 'CONFIGURED' : 'UNCONFIGURED'}
          </span>
        </div>

        <p className="text-xs text-nero-muted mb-4">{description}</p>

        {/* Inputs */}
        <div className="flex flex-col gap-3">
          {hasApiKey && (
            <div>
              <label className="text-[10px] font-mono uppercase text-nero-muted block mb-1">
                API Key
              </label>
              <input
                type="password"
                placeholder={isConfigured ? '••••••••••••••••' : 'Enter API Key'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full text-xs font-mono bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-nero-text placeholder:text-nero-muted/60 focus:border-nero-cyan/50 outline-none"
              />
            </div>
          )}

          {defaultBaseUrl !== undefined && (
            <div>
              <label className="text-[10px] font-mono uppercase text-nero-muted block mb-1">
                Endpoint URL
              </label>
              <input
                type="text"
                placeholder="http://localhost:11434"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full text-xs font-mono bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-nero-text focus:border-nero-cyan/50 outline-none"
              />
            </div>
          )}

          {models && models.length > 0 ? (
            <div>
              <label className="text-[10px] font-mono uppercase text-nero-muted block mb-1">
                Model
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full text-xs font-mono bg-[#0c0c14] border border-white/10 rounded-lg px-2.5 py-1.5 text-nero-text focus:border-nero-cyan/50 outline-none"
              >
                {models.map((m) => (
                  <option key={m} value={m} className="bg-[#0c0c14]">
                    {m}
                  </option>
                ))}
              </select>
            </div>
          ) : defaultModel ? (
            <div>
              <label className="text-[10px] font-mono uppercase text-nero-muted block mb-1">
                Model Name
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full text-xs font-mono bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-nero-text focus:border-nero-cyan/50 outline-none"
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* Actions and Status */}
      <div className="mt-5 pt-3 border-t border-white/5 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-nero-muted">{type}</span>
          {testResult && (
            <span
              className={
                testResult.success
                  ? 'text-emerald-400 font-semibold'
                  : 'text-red-400 font-semibold'
              }
            >
              {testResult.text}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleTest}
            disabled={isTesting}
            className="flex-1 text-center justify-center text-xs"
          >
            {isTesting ? 'Testing...' : 'Test Connection'}
          </Button>

          <Button
            size="sm"
            variant={isActive ? 'ghost' : 'primary'}
            onClick={() => handleSave(true)}
            disabled={isSaving}
            className="flex-1 text-center justify-center text-xs"
          >
            {isActive ? 'Save' : 'Activate'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SettingsView() {
  const { personalityMode, setPersonalityMode, backendStatus, wsStatus } = useAppStore();
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [activeProviderName, setActiveProviderName] = useState<string>('offline');

  const loadProviders = async () => {
    try {
      const res = await api.providers.list();
      if (res?.providers) {
        setProviders(res.providers);
        setActiveProviderName(res.active_provider);
      }
    } catch {
      // Offline fallback
    }
  };

  useEffect(() => {
    void loadProviders();
  }, []);

  const handleProviderSave = async (
    providerId: string,
    config: { apiKey?: string; model?: string; baseUrl?: string; isActive: boolean },
  ) => {
    await api.providers.saveConfig({
      provider: providerId,
      api_key: config.apiKey,
      model: config.model,
      base_url: config.baseUrl,
      is_active: config.isActive,
    });
    await loadProviders();
  };

  const handleProviderTest = async (providerId: string) => {
    return await api.providers.test({ provider: providerId });
  };

  const personalityModes: Array<{ id: PersonalityMode; label: string; desc: string }> = [
    { id: 'adaptive', label: 'Adaptive', desc: 'Dynamically balances tone and responsiveness based on context.' },
    { id: 'friend', label: 'Friend', desc: 'Warm, conversational, empathetic, and encouraging.' },
    { id: 'professional', label: 'Professional', desc: 'Direct, structured, objective, and concise.' },
    { id: 'focus', label: 'Focus', desc: 'Distraction-free, minimal responses centered on high productivity.' },
    { id: 'supportive', label: 'Supportive', desc: 'Gentle, thoughtful guidance with positive reinforcement.' },
  ];

  const handlePersonalityChange = async (mode: PersonalityMode) => {
    setPersonalityMode(mode);
    try {
      await api.personality.setMode(mode);
    } catch {
      // optimistic update
    }
  };

  const isGeminiActive = activeProviderName === 'gemini';
  const isOpenAIActive = activeProviderName === 'openai';
  const isOllamaActive = activeProviderName === 'ollama';
  const isOfflineActive = activeProviderName === 'offline';

  const geminiInfo = providers.find((p) => p.name === 'gemini');
  const openaiInfo = providers.find((p) => p.name === 'openai');
  const ollamaInfo = providers.find((p) => p.name === 'ollama');

  return (
    <div className="h-full w-full overflow-y-auto p-6 flex flex-col gap-6 bg-nero-bg">
      <div>
        <h1 className="text-2xl font-bold text-nero-text">Settings</h1>
        <p className="text-xs text-nero-muted mt-1">
          Configure NERO AI models, connection, and personality traits.
        </p>
      </div>

      {/* AI Provider Section */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono uppercase tracking-widest text-nero-muted">
            AI Providers & Intelligence
          </h2>
          <span className="text-[11px] font-mono text-nero-cyan">
            Active: <strong className="uppercase">{activeProviderName}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Gemini */}
          <ProviderConfigCard
            id="gemini"
            name="Google Gemini"
            type="Cloud / API"
            description="High-speed multimodal intelligence via Google Gemini API."
            isActive={isGeminiActive}
            isConfigured={geminiInfo?.is_configured ?? false}
            models={['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp']}
            defaultModel={geminiInfo?.default_model || 'gemini-1.5-flash'}
            onSave={(cfg) => handleProviderSave('gemini', cfg)}
            onTest={() => handleProviderTest('gemini')}
          />

          {/* OpenAI */}
          <ProviderConfigCard
            id="openai"
            name="OpenAI"
            type="Cloud / API"
            description="GPT-4o reasoning, structured intelligence, and mastery."
            isActive={isOpenAIActive}
            isConfigured={openaiInfo?.is_configured ?? false}
            models={['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo']}
            defaultModel={openaiInfo?.default_model || 'gpt-4o-mini'}
            onSave={(cfg) => handleProviderSave('openai', cfg)}
            onTest={() => handleProviderTest('openai')}
          />

          {/* Ollama */}
          <ProviderConfigCard
            id="ollama"
            name="Ollama Local"
            type="Local / Offline"
            description="Completely private offline local inference on your hardware."
            isActive={isOllamaActive}
            isConfigured={ollamaInfo?.is_configured ?? false}
            hasApiKey={false}
            defaultBaseUrl="http://localhost:11434"
            defaultModel={ollamaInfo?.default_model || 'llama3.2'}
            onSave={(cfg) => handleProviderSave('ollama', cfg)}
            onTest={() => handleProviderTest('ollama')}
          />

          {/* Built-in Offline Fallback */}
          <ProviderConfigCard
            id="offline"
            name="NERO Offline"
            type="Local Built-in"
            description="Built-in rule and heuristic engine. Always works with 0 API keys."
            isActive={isOfflineActive}
            isConfigured={true}
            hasApiKey={false}
            defaultModel="rule-based"
            onSave={(cfg) => handleProviderSave('offline', cfg)}
            onTest={() => handleProviderTest('offline')}
          />
        </div>
      </section>

      {/* Personality Mode */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-nero-muted">
          Personality Mode
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {personalityModes.map((item) => {
            const isSelected = personalityMode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => void handlePersonalityChange(item.id)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  isSelected
                    ? 'border-nero-cyan bg-nero-cyan/10 cyan-glow-sm'
                    : 'glass border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-sm font-semibold ${
                      isSelected ? 'text-nero-cyan' : 'text-nero-text'
                    }`}
                  >
                    {item.label}
                  </span>
                  <div
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      isSelected ? 'border-nero-cyan bg-nero-cyan' : 'border-nero-muted'
                    }`}
                  >
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-nero-bg" />}
                  </div>
                </div>
                <p className="text-xs text-nero-muted">{item.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Connection Section */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-nero-muted">Connection</h2>
        <Card className="flex flex-col gap-4" animate={false}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-nero-muted mb-1 font-mono">BACKEND HTTP ENDPOINT</p>
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/40 border border-white/5">
                <span className="font-mono text-xs text-nero-text">http://localhost:8765</span>
                <span className="text-[10px] font-mono uppercase text-nero-cyan">
                  {backendStatus}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-nero-muted mb-1 font-mono">WEBSOCKET ENDPOINT</p>
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/40 border border-white/5">
                <span className="font-mono text-xs text-nero-text">ws://localhost:8765/ws</span>
                <span className="text-[10px] font-mono uppercase text-nero-cyan">{wsStatus}</span>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* About Section */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-nero-muted">About NERO</h2>
        <Card className="flex flex-col gap-2" animate={false}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-nero-text">NERO Desktop</span>
            <span className="text-xs font-mono text-nero-cyan">v0.2.0-phase2</span>
          </div>
          <p className="text-xs text-nero-muted leading-relaxed">
            Windows Desktop AI Companion with local and cloud multimodal intelligence, real-time
            streaming SSE, and adaptive personality core.
          </p>
        </Card>
      </section>
    </div>
  );
}
