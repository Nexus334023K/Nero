import { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { useToolsStore } from '../../stores/toolsStore';
import { voiceService } from '../../services/voice';
import { AudioDeviceSettings } from './components/AudioDeviceSettings';
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
  onTest: (config?: { apiKey?: string; model?: string; baseUrl?: string }) => Promise<{
    success: boolean;
    latency_ms?: number;
    message?: string;
  }>;
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
      const res = await onTest({
        apiKey: apiKey.trim() || undefined,
        model: model.trim() || undefined,
        baseUrl: baseUrl.trim() || undefined,
      });
      if (res.success) {
        setTestResult({
          success: true,
          text: `Online (${Math.round(res.latency_ms ?? 120)}ms)`,
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
  const {
    ttsProvider,
    setTtsProvider,
    activeVoiceId,
    setActiveVoiceId,
    wakeWordEnabled,
    setWakeWordEnabled,
    speed,
    setSpeed,
    fishApiKey: storedFishKey,
    fishRefId: storedFishRef,
    setFishApiKey: setStoredFishKey,
    setFishRefId: setStoredFishRef,
  } = useVoiceStore();
  const { tools, fetchTools, updateToolPermission } = useToolsStore();
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [activeProviderName, setActiveProviderName] = useState<string>('offline');
  const [fishApiKey, setFishApiKey] = useState(storedFishKey || '');
  const [fishRefId, setFishRefId] = useState(storedFishRef || '');
  const [showFishKey, setShowFishKey] = useState(false);
  const [elevenApiKey, setElevenApiKey] = useState('');
  const [voiceSaveStatus, setVoiceSaveStatus] = useState<string | null>(null);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [fishTestFeedback, setFishTestFeedback] = useState<{ success?: boolean; message?: string } | null>(null);

  useEffect(() => {
    api.voice
      .getSettings()
      .then((s) => {
        if (s) {
          if (s.tts_provider) setTtsProvider(s.tts_provider);
          if (s.fish_audio_api_key) {
            setFishApiKey(s.fish_audio_api_key);
            setStoredFishKey(s.fish_audio_api_key);
          } else if (storedFishKey) {
            setFishApiKey(storedFishKey);
          }
          if (s.fish_audio_reference_id) {
            setFishRefId(s.fish_audio_reference_id);
            setStoredFishRef(s.fish_audio_reference_id);
          } else if (storedFishRef) {
            setFishRefId(storedFishRef);
          }
          if (s.elevenlabs_api_key) setElevenApiKey(s.elevenlabs_api_key);
          if (s.wake_word_enabled !== undefined) setWakeWordEnabled(s.wake_word_enabled);
          if (s.speed) setSpeed(s.speed);
        }
      })
      .catch(() => {});
  }, [setTtsProvider, setWakeWordEnabled, setSpeed, storedFishKey, storedFishRef, setStoredFishKey, setStoredFishRef]);

  const handleSaveVoiceSettings = async () => {
    try {
      await api.voice.updateSettings({
        tts_provider: ttsProvider,
        fish_audio_api_key: fishApiKey.trim(),
        fish_audio_reference_id: fishRefId.trim(),
        elevenlabs_api_key: elevenApiKey.trim(),
        wake_word_enabled: wakeWordEnabled,
        speed,
        allow_fallback: false,
      });
      setStoredFishKey(fishApiKey.trim());
      setStoredFishRef(fishRefId.trim());
      if (fishRefId.trim()) {
        setActiveVoiceId(fishRefId.trim());
      }
      setVoiceSaveStatus('Voice settings saved and active!');
      setTimeout(() => setVoiceSaveStatus(null), 3500);
    } catch {
      setVoiceSaveStatus('Error saving voice settings.');
    }
  };

  const handleTestVoice = async () => {
    setIsTestingVoice(true);
    setFishTestFeedback(null);

    // Ensure backend has current credentials before playing
    try {
      await api.voice.updateSettings({
        tts_provider: ttsProvider,
        fish_audio_api_key: fishApiKey.trim(),
        fish_audio_reference_id: fishRefId.trim(),
        elevenlabs_api_key: elevenApiKey.trim(),
        wake_word_enabled: wakeWordEnabled,
        speed,
        allow_fallback: false,
      });
    } catch {}

    const targetVoice = fishRefId.trim() || activeVoiceId;
    const testText = ttsProvider === 'fish_audio'
      ? 'Hello, this is Nero testing Fish Audio speech synthesis.'
      : 'NERO voice engine test. Speech synthesis verified.';

    const ok = await voiceService.speak(testText, ttsProvider, targetVoice);
    setIsTestingVoice(false);

    if (ok) {
      setFishTestFeedback({
        success: true,
        message: 'Speech synthesized and playing successfully!',
      });
    } else {
      const err = useVoiceStore.getState().ttsError || 'Failed to synthesize speech.';
      setFishTestFeedback({
        success: false,
        message: err,
      });
    }
  };

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
    void fetchTools();
  }, [fetchTools]);

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

  const handleProviderTest = async (
    providerId: string,
    cfg?: { apiKey?: string; model?: string; baseUrl?: string },
  ) => {
    return await api.providers.test({
      provider: providerId,
      api_key: cfg?.apiKey,
      model: cfg?.model,
      base_url: cfg?.baseUrl,
    });
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
            models={['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-pro-latest', 'gemini-2.5-flash']}
            defaultModel={geminiInfo?.default_model || 'gemini-flash-lite-latest'}
            onSave={(cfg) => handleProviderSave('gemini', cfg)}
            onTest={(cfg) => handleProviderTest('gemini', cfg)}
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
            onTest={(cfg) => handleProviderTest('openai', cfg)}
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
            onTest={(cfg) => handleProviderTest('ollama', cfg)}
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
            onTest={(cfg) => handleProviderTest('offline', cfg)}
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

      {/* Audio & Devices Section */}
      <AudioDeviceSettings />

      {/* Voice Intelligence & Fish Audio Section */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono uppercase tracking-widest text-nero-muted">
            Voice Intelligence & Speech Synthesis
          </h2>
          {voiceSaveStatus && (
            <span className="text-xs font-mono text-emerald-400 font-semibold">{voiceSaveStatus}</span>
          )}
        </div>

        <Card className="flex flex-col gap-5" animate={false}>
          {/* TTS Provider Selector */}
          <div>
            <label className="text-[10px] font-mono uppercase text-nero-muted block mb-2">
              Primary Speech Synthesis Engine (TTS)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { id: 'fish_audio', label: 'Fish Audio', badge: 'Cloud Neural' },
                { id: 'piper', label: 'Piper TTS', badge: 'Local Neural' },
                { id: 'elevenlabs', label: 'ElevenLabs', badge: 'Cloud' },
                { id: 'mock', label: 'Offline Waveform', badge: 'Local Built-in' },
              ].map((prov) => {
                const isSelected = ttsProvider === prov.id;
                return (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => setTtsProvider(prov.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-nero-cyan bg-nero-cyan/15 cyan-glow-sm'
                        : 'border-white/5 bg-white/2 hover:border-white/20'
                    }`}
                  >
                    <div className="text-xs font-semibold text-nero-text mb-0.5">{prov.label}</div>
                    <div className="text-[10px] text-nero-cyan/80 font-mono">{prov.badge}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fish Audio Settings */}
          {ttsProvider === 'fish_audio' && (
            <div className="p-4 rounded-xl border border-nero-cyan/20 bg-nero-cyan/5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-nero-cyan font-mono uppercase tracking-wider">
                    Fish Audio Configuration
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-nero-cyan/10 border border-nero-cyan/30 text-nero-cyan font-mono">
                    Model: s2.1-pro
                  </span>
                </div>
                <span className="text-[10px] text-nero-muted">Official v1 Neural Audio</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-mono uppercase text-nero-muted block">
                      Fish Audio API Key *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowFishKey(!showFishKey)}
                      className="text-[10px] text-nero-cyan hover:underline font-mono"
                    >
                      {showFishKey ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <input
                    type={showFishKey ? 'text' : 'password'}
                    placeholder="Enter Fish Audio API Key..."
                    value={fishApiKey}
                    onChange={(e) => setFishApiKey(e.target.value)}
                    className="w-full text-xs font-mono bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-nero-text focus:border-nero-cyan/50 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase text-nero-muted block mb-1">
                    Voice Reference ID (reference_id)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 54f224d5500e482390f77977a41496d0"
                    value={fishRefId}
                    onChange={(e) => setFishRefId(e.target.value)}
                    className="w-full text-xs font-mono bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-nero-text focus:border-nero-cyan/50 outline-none"
                  />
                  <span className="text-[10px] text-nero-muted block mt-1">
                    Default: <code>54f224d5500e482390f77977a41496d0</code> (Fish Natural)
                  </span>
                </div>
              </div>

              {/* Dedicated Fish Audio Test & Feedback */}
              <div className="pt-2 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleTestVoice}
                    disabled={isTestingVoice || !fishApiKey.trim()}
                    className="text-xs font-mono"
                  >
                    {isTestingVoice ? 'Synthesizing & Playing...' : '🔊 Test Fish Audio Voice'}
                  </Button>
                  <span className="text-[10px] text-nero-muted font-mono">
                    Tests live endpoint & plays returned MP3 speech
                  </span>
                </div>

                {fishTestFeedback && (
                  <div
                    className={`text-xs px-3 py-1 rounded-lg border font-mono ${
                      fishTestFeedback.success
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {fishTestFeedback.message}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ElevenLabs Settings */}
          {ttsProvider === 'elevenlabs' && (
            <div className="p-4 rounded-xl border border-white/10 bg-white/5 flex flex-col gap-3">
              <span className="text-xs font-bold text-nero-text font-mono uppercase">
                ElevenLabs Configuration
              </span>
              <div>
                <label className="text-[10px] font-mono uppercase text-nero-muted block mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  placeholder="xi-api-key..."
                  value={elevenApiKey}
                  onChange={(e) => setElevenApiKey(e.target.value)}
                  className="w-full text-xs font-mono bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-nero-text focus:border-nero-cyan/50 outline-none"
                />
              </div>
            </div>
          )}

          {/* Hands-Free Wake-Word & Speed Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 border-t border-white/5">
            <div className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-white/5">
              <div>
                <div className="text-xs font-semibold text-nero-text">Hands-Free Wake Word</div>
                <div className="text-[10px] text-nero-muted font-mono">Triggers on "Hey NERO"</div>
              </div>
              <button
                type="button"
                onClick={() => setWakeWordEnabled(!wakeWordEnabled)}
                className={`px-3 py-1 rounded text-xs font-medium font-mono transition-colors ${
                  wakeWordEnabled
                    ? 'bg-nero-success/20 text-nero-success border border-nero-success/40'
                    : 'bg-white/10 text-nero-muted'
                }`}
              >
                {wakeWordEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleTestVoice}
                disabled={isTestingVoice}
                className="flex-1 justify-center text-xs"
              >
                {isTestingVoice ? 'Playing...' : 'Test Voice Audio'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveVoiceSettings}
                className="flex-1 justify-center text-xs"
              >
                Save Voice Settings
              </Button>
            </div>
          </div>
          {voiceSaveStatus && (
            <div className="text-xs font-mono text-center py-1 text-nero-cyan bg-nero-cyan/10 rounded border border-nero-cyan/30">
              {voiceSaveStatus}
            </div>
          )}
        </Card>
      </section>

      {/* Desktop Tools & Security Policies */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono uppercase tracking-widest text-nero-muted">
            Desktop Automation & Security Policies
          </h2>
          <span className="text-[11px] font-mono text-nero-cyan">Phase 5</span>
        </div>
        <Card className="flex flex-col gap-3" animate={false}>
          <p className="text-xs text-nero-muted leading-relaxed">
            Control the permission level for each tool. In &lsquo;Auto&rsquo; mode, actions execute
            immediately. In &lsquo;Permission Required&rsquo; or &lsquo;Explicit Confirmation&rsquo;, NERO
            will request your interactive approval before executing.
          </p>

          <div className="overflow-x-auto mt-1">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-white/10 text-nero-muted font-mono">
                  <th className="pb-2">Tool</th>
                  <th className="pb-2">Description</th>
                  <th className="pb-2">Permission Tier</th>
                  <th className="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tools.map((t) => (
                  <tr key={t.name}>
                    <td className="py-2.5 font-mono text-nero-cyan font-medium">{t.name}</td>
                    <td className="py-2.5 text-nero-muted max-w-xs">{t.description}</td>
                    <td className="py-2.5">
                      <select
                        value={t.configured_permission}
                        onChange={(e) =>
                          void updateToolPermission(t.name, e.target.value, t.is_enabled)
                        }
                        className="px-2 py-1 rounded bg-white/5 border border-white/10 font-mono text-[11px] text-nero-text focus:outline-none focus:border-nero-cyan"
                      >
                        <option value="auto">Auto (Immediate)</option>
                        <option value="permission_required">Permission Required</option>
                        <option value="explicit_confirmation">Explicit Confirmation</option>
                      </select>
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          void updateToolPermission(
                            t.name,
                            t.configured_permission,
                            !t.is_enabled,
                          )
                        }
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono transition-colors ${
                          t.is_enabled
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-white/5 text-nero-muted'
                        }`}
                      >
                        {t.is_enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
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
            <span className="text-xs font-mono text-nero-cyan">v1.0.0 (Production)</span>
          </div>
          <p className="text-xs text-nero-muted leading-relaxed">
            Windows Desktop AI Companion with multimodal cloud and offline intelligence, persistent
            ChromaDB vector memory, Fish Audio voice synthesis, permission-guarded desktop
            automation, and developer companion suite.
          </p>
        </Card>
      </section>
    </div>
  );
}
