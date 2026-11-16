import { useAppStore } from '../../stores/appStore';
import { Card } from '../../components/ui/Card';
import type { PersonalityMode } from '../../types';

interface ProviderCardProps {
  name: string;
  type: string;
  status: 'connected' | 'configured' | 'unavailable';
  description: string;
}

function ProviderCard({ name, type, status, description }: ProviderCardProps) {
  const statusStyles = {
    connected: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    configured: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    unavailable: 'bg-white/5 text-nero-muted border-white/5',
  };

  return (
    <div className="glass rounded-xl p-4 flex flex-col justify-between border border-white/5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-sm text-nero-text">{name}</h4>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${statusStyles[status]}`}>
            {status}
          </span>
        </div>
        <p className="text-xs text-nero-muted leading-relaxed">{description}</p>
      </div>
      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
        <span className="text-[10px] font-mono text-nero-muted">{type}</span>
      </div>
    </div>
  );
}

export function SettingsView() {
  const { personalityMode, setPersonalityMode, backendStatus, wsStatus } = useAppStore();

  const personalityModes: Array<{ id: PersonalityMode; label: string; desc: string }> = [
    { id: 'adaptive', label: 'Adaptive', desc: 'Dynamically balances tone and responsiveness based on context.' },
    { id: 'friend', label: 'Friend', desc: 'Warm, conversational, empathetic, and encouraging.' },
    { id: 'professional', label: 'Professional', desc: 'Direct, structured, objective, and concise.' },
    { id: 'focus', label: 'Focus', desc: 'Distraction-free, minimal responses centered on high productivity.' },
    { id: 'supportive', label: 'Supportive', desc: 'Gentle, thoughtful guidance with positive reinforcement.' },
  ];

  return (
    <div className="h-full w-full overflow-y-auto p-6 flex flex-col gap-6 bg-nero-bg">
      <div>
        <h1 className="text-2xl font-bold text-nero-text">Settings</h1>
        <p className="text-xs text-nero-muted mt-1">Configure NERO AI models, connection, and personality traits.</p>
      </div>

      {/* AI Provider Section */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-nero-muted">AI Providers</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ProviderCard
            name="Google Gemini"
            type="Cloud / API"
            status="configured"
            description="High-speed multimodal intelligence via Gemini 1.5/2.0 API."
          />
          <ProviderCard
            name="OpenAI"
            type="Cloud / API"
            status="configured"
            description="GPT-4o reasoning, structured tools, and conversational mastery."
          />
          <ProviderCard
            name="Ollama (Local)"
            type="Local / Offline"
            status="unavailable"
            description="Completely private offline inference running locally on your hardware."
          />
        </div>
      </section>

      {/* Personality Mode */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-nero-muted">Personality Mode</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {personalityModes.map((item) => {
            const isSelected = personalityMode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setPersonalityMode(item.id)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  isSelected
                    ? 'border-nero-cyan bg-nero-cyan/10 cyan-glow-sm'
                    : 'glass border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-semibold ${isSelected ? 'text-nero-cyan' : 'text-nero-text'}`}>
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
                <span className="text-[10px] font-mono uppercase text-nero-cyan">{backendStatus}</span>
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
            <span className="text-xs font-mono text-nero-cyan">v0.1.0-alpha</span>
          </div>
          <p className="text-xs text-nero-muted leading-relaxed">
            Windows Desktop AI Companion with local and cloud multimodal intelligence, voice capabilities, and reactive state machine core.
          </p>
        </Card>
      </section>
    </div>
  );
}
