import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { ProviderItem } from '../../types';

export interface ProviderModelPreset {
  id: string;
  name: string;
  models: Array<{
    id: string;
    label: string;
    desc: string;
    badge?: string;
  }>;
}

export const PRESET_PROVIDERS: ProviderModelPreset[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    models: [
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', desc: 'Fast, lightweight, multivariable reasoning', badge: 'Popular' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', desc: 'Next-gen multimodal, realtime speed', badge: 'New' },
      { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', desc: 'Complex reasoning, extensive context window' },
      { id: 'gemini-flash-lite-latest', label: 'Gemini Flash Lite', desc: 'Ultra low latency, cost-effective' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI ChatGPT',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o', desc: 'Flagship omnimodal intelligence', badge: 'Flagship' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini', desc: 'Fast, efficient, affordable' },
      { id: 'o3-mini', label: 'o3-mini', desc: 'Advanced STEM and multi-step reasoning', badge: 'Reasoning' },
      { id: 'o1-mini', label: 'o1-mini', desc: 'Specialized code and math reasoning' },
      { id: 'gpt-4-turbo', label: 'GPT-4 Turbo', desc: 'High context capability' },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    models: [
      { id: 'llama3.2', label: 'Llama 3.2', desc: 'Meta open weights 3B/1B', badge: 'Local' },
      { id: 'deepseek-r1', label: 'DeepSeek R1', desc: 'Open reasoning powerhouse' },
      { id: 'qwen2.5-coder', label: 'Qwen 2.5 Coder', desc: 'Advanced programming specialist' },
      { id: 'mistral', label: 'Mistral 7B', desc: 'Reliable general instruction' },
    ],
  },
  {
    id: 'offline',
    name: 'NERO Offline',
    models: [
      { id: 'nero-heuristic-v1', label: 'NERO Heuristic v1', desc: '100% private, zero-latency desktop engine', badge: 'Built-in' },
    ],
  },
];

interface ModelSelectorProps {
  activeProviderInfo: string;
  onModelChanged: (info: string) => void;
}

export function ModelSelector({ activeProviderInfo, onModelChanged }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [activeProviderName, setActiveProviderName] = useState<string>('gemini');
  const [activeModelName, setActiveModelName] = useState<string>('gemini-1.5-flash');
  const [selectedTab, setSelectedTab] = useState<string>('gemini');
  const [customModel, setCustomModel] = useState<string>('');
  const [isSwitching, setIsSwitching] = useState<boolean>(false);
  const [switchFeedback, setSwitchFeedback] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Load providers from backend
  const refreshProviders = async () => {
    try {
      const res = await api.providers.list();
      if (res?.providers) {
        setProviders(res.providers);
        if (res.active_provider) {
          setActiveProviderName(res.active_provider);
          setSelectedTab(res.active_provider);
          const activeItem = res.providers.find((p) => p.name === res.active_provider || p.is_active);
          if (activeItem) {
            setActiveModelName(activeItem.default_model);
            onModelChanged(`${activeItem.name} (${activeItem.default_model})`);
          }
        }
      }
    } catch {
      // Offline fallback
    }
  };

  useEffect(() => {
    void refreshProviders();
  }, []);

  // Parse current active provider name and model from activeProviderInfo
  useEffect(() => {
    const match = activeProviderInfo.match(/^([a-zA-Z0-9_-]+)\s*\((.+)\)$/);
    if (match) {
      setActiveProviderName(match[1]);
      setActiveModelName(match[2]);
      setSelectedTab(match[1]);
    } else if (activeProviderInfo) {
      setActiveProviderName(activeProviderInfo);
      setSelectedTab(activeProviderInfo);
    }
  }, [activeProviderInfo]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectModel = async (providerId: string, modelId: string) => {
    setIsSwitching(true);
    setSwitchFeedback(null);
    try {
      await api.providers.saveConfig({
        provider: providerId,
        model: modelId,
        is_active: true,
      });

      setActiveProviderName(providerId);
      setActiveModelName(modelId);
      const newInfo = `${providerId} (${modelId})`;
      onModelChanged(newInfo);

      setSwitchFeedback(`Switched to ${modelId}!`);
      setTimeout(() => {
        setSwitchFeedback(null);
        setIsOpen(false);
      }, 700);

      await refreshProviders();
    } catch (err) {
      setSwitchFeedback('Failed to switch model.');
    } finally {
      setIsSwitching(false);
    }
  };

  const handleApplyCustomModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customModel.trim()) return;
    void handleSelectModel(selectedTab, customModel.trim());
    setCustomModel('');
  };

  const currentTabPreset = PRESET_PROVIDERS.find((p) => p.id === selectedTab) || PRESET_PROVIDERS[0];
  const currentProviderInfo = providers.find((p) => p.name === selectedTab);
  const isTabConfigured = currentProviderInfo ? currentProviderInfo.is_configured : (selectedTab === 'offline');

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Active provider badge / interactive trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Click to choose or switch AI model"
        className="flex items-center gap-2 px-3 py-1 rounded-full bg-nero-cyan/10 border border-nero-cyan/40 hover:border-nero-cyan hover:bg-nero-cyan/20 transition-all text-nero-cyan text-[11px] font-mono cursor-pointer shadow-sm group"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-nero-cyan animate-pulse group-hover:scale-125 transition-transform" />
        <span className="font-medium tracking-tight">{activeProviderInfo || 'Select Model'}</span>
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-nero-cyan/70 group-hover:text-nero-cyan transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-[380px] max-w-[90vw] rounded-2xl bg-[#0c0c14]/95 backdrop-blur-xl border border-white/10 shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-3.5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
            <div>
              <h3 className="text-xs font-semibold text-nero-text flex items-center gap-1.5">
                <span>Select AI Model</span>
                {switchFeedback && (
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {switchFeedback}
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-nero-muted mt-0.5">
                Switch provider or choose any model on the fly
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-nero-muted hover:text-white p-1 rounded-lg hover:bg-white/5 text-xs"
            >
              ✕
            </button>
          </div>

          {/* Provider Tabs */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-black/40 border border-white/5 rounded-xl">
            {PRESET_PROVIDERS.map((prov) => {
              const isSelected = selectedTab === prov.id;
              const isProvConfigured = providers.find((p) => p.name === prov.id)?.is_configured ?? (prov.id === 'offline');
              return (
                <button
                  key={prov.id}
                  type="button"
                  onClick={() => setSelectedTab(prov.id)}
                  className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-[10px] font-medium transition-all ${
                    isSelected
                      ? 'bg-nero-cyan/20 text-nero-cyan border border-nero-cyan/30 shadow-sm'
                      : 'text-nero-muted hover:text-nero-text hover:bg-white/5'
                  }`}
                >
                  <span className="capitalize">{prov.id}</span>
                  <span
                    className={`w-1 h-1 rounded-full mt-1 ${
                      isProvConfigured ? 'bg-emerald-400' : 'bg-amber-400/70'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Configuration status warning if unconfigured */}
          {!isTabConfigured && selectedTab !== 'offline' && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
              <span>{currentTabPreset.name} API key not configured</span>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/settings');
                }}
                className="text-[10px] font-semibold underline hover:text-amber-200"
              >
                Setup →
              </button>
            </div>
          )}

          {/* Preset Models List */}
          <div className="flex flex-col gap-1.5 max-h-[190px] overflow-y-auto pr-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-nero-muted mb-0.5">
              Available Models ({currentTabPreset.name})
            </span>
            {currentTabPreset.models.map((m) => {
              const isActiveModel =
                activeProviderName === selectedTab && activeModelName === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={isSwitching}
                  onClick={() => void handleSelectModel(selectedTab, m.id)}
                  className={`flex items-center justify-between p-2 rounded-xl border text-left transition-all ${
                    isActiveModel
                      ? 'bg-nero-cyan/15 border-nero-cyan/50 text-nero-cyan shadow-sm'
                      : 'bg-white/[0.02] border-white/5 hover:border-white/15 hover:bg-white/[0.06] text-nero-text'
                  }`}
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium font-mono">{m.label}</span>
                      {m.badge && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-nero-muted border border-white/10">
                          {m.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-nero-muted leading-tight mt-0.5">
                      {m.desc}
                    </span>
                  </div>

                  {isActiveModel ? (
                    <div className="flex items-center gap-1 text-[10px] font-mono text-nero-cyan shrink-0">
                      <span>ACTIVE</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-nero-cyan" />
                    </div>
                  ) : (
                    <span className="text-[10px] font-mono text-nero-muted/60 opacity-0 group-hover:opacity-100 hover:text-nero-cyan">
                      Use
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom Model Input */}
          <form onSubmit={handleApplyCustomModel} className="pt-2 border-t border-white/5 flex flex-col gap-1.5">
            <label className="text-[10px] font-mono uppercase text-nero-muted">
              Use Any Custom Model
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder={`e.g. ${selectedTab === 'gemini' ? 'gemini-exp-1206' : selectedTab === 'openai' ? 'gpt-4o-2024-08-06' : 'deepseek-v3'}`}
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                className="flex-1 text-xs font-mono bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-nero-text focus:border-nero-cyan/60 outline-none placeholder:text-nero-muted/40"
              />
              <button
                type="submit"
                disabled={!customModel.trim() || isSwitching}
                className="px-3 py-1.5 rounded-lg bg-nero-cyan text-nero-bg font-semibold text-xs hover:bg-nero-cyan/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                Apply
              </button>
            </div>
          </form>

          {/* Footer with settings link */}
          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-nero-muted">
            <span>Provider: <strong className="text-nero-text capitalize">{selectedTab}</strong></span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/settings');
              }}
              className="text-nero-cyan hover:underline flex items-center gap-1"
            >
              <span>Settings</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
