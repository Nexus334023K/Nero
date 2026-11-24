import { useEffect, useState } from 'react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ModelSelector } from './ModelSelector';
import { useChatStore } from '../../stores/chatStore';
import { useAppStore } from '../../stores/appStore';
import { api } from '../../services/api';
import type { PersonalityMode } from '../../types';

const PERSONALITY_MODES: Array<{ id: PersonalityMode; label: string }> = [
  { id: 'adaptive', label: 'Adaptive' },
  { id: 'friend', label: 'Friend' },
  { id: 'professional', label: 'Professional' },
  { id: 'focus', label: 'Focus' },
  { id: 'supportive', label: 'Supportive' },
];

export function ChatView() {
  const { setConversations } = useChatStore();
  const { personalityMode, setPersonalityMode } = useAppStore();
  const [activeProviderInfo, setActiveProviderInfo] = useState<string>('offline');
  const [showModeSelector, setShowModeSelector] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Load conversations
    api.chat
      .getConversations()
      .then((res) => {
        if (mounted && res?.conversations) {
          setConversations(
            res.conversations.map((c) => ({
              id: c.id,
              title: c.title,
              personality_mode: (c.personality_mode as PersonalityMode) || 'adaptive',
              created_at: c.created_at,
              updated_at: c.created_at,
            })),
          );
        }
      })
      .catch(() => {});

    // Load active provider & model
    api.providers
      .list()
      .then((res) => {
        if (mounted && res?.providers) {
          const active = res.providers.find((p) => p.name === res.active_provider || p.is_active);
          if (active) {
            setActiveProviderInfo(`${active.name} (${active.default_model})`);
          } else if (res.active_provider) {
            setActiveProviderInfo(res.active_provider);
          }
        }
      })
      .catch(() => {});

    // Sync personality mode with backend
    api.personality
      .getModes()
      .then((res) => {
        if (mounted && res?.active_mode) {
          setPersonalityMode(res.active_mode as PersonalityMode);
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [setConversations, setPersonalityMode]);

  const handleSelectMode = async (mode: PersonalityMode) => {
    setPersonalityMode(mode);
    setShowModeSelector(false);
    try {
      await api.personality.setMode(mode);
    } catch {
      // Keep UI updated optimistically
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-nero-bg">
      {/* Header */}
      <div className="h-14 px-6 flex items-center justify-between border-b border-nero-border glass shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-nero-text">Chat Session</span>
            <span className="text-xs text-nero-muted font-mono">/ Live</span>
          </div>

          {/* Active provider & model selector */}
          <div className="hidden sm:block">
            <ModelSelector
              activeProviderInfo={activeProviderInfo}
              onModelChanged={(info) => setActiveProviderInfo(info)}
            />
          </div>
        </div>

        {/* Personality Mode selector pill */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowModeSelector(!showModeSelector)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 glass glass-hover text-xs font-medium text-nero-text transition-colors"
          >
            <span className="text-nero-muted font-mono text-[10px] uppercase">Persona:</span>
            <span className="text-nero-cyan capitalize">{personalityMode}</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`text-nero-muted transition-transform ${showModeSelector ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showModeSelector && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl bg-[#0e0e17] border border-white/10 shadow-2xl p-1.5 flex flex-col gap-1 z-50">
              <span className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-nero-muted">
                Select Personality
              </span>
              {PERSONALITY_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => void handleSelectMode(mode.id)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                    personalityMode === mode.id
                      ? 'bg-nero-cyan/15 text-nero-cyan font-medium'
                      : 'text-nero-text hover:bg-white/5'
                  }`}
                >
                  <span>{mode.label}</span>
                  {personalityMode === mode.id && (
                    <div className="w-1.5 h-1.5 rounded-full bg-nero-cyan" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <MessageList />
      <MessageInput />
    </div>
  );
}
