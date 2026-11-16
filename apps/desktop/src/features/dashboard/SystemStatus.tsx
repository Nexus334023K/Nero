import { useAppStore } from '../../stores/appStore';
import { StatusDot, AIStateBadge } from '../../components/ui/StatusIndicator';
import { Card } from '../../components/ui/Card';

export function SystemStatus() {
  const { backendStatus, wsStatus, aiState, backendVersion, lastHealthCheck, personalityMode } =
    useAppStore();

  const formatTime = (ts: string | null) => {
    if (!ts) return 'Never';
    try {
      return new Date(ts).toLocaleTimeString();
    } catch {
      return ts;
    }
  };

  const personalityLabels: Record<string, string> = {
    friend: 'Friend',
    professional: 'Professional',
    focus: 'Focus',
    supportive: 'Supportive',
    adaptive: 'Adaptive',
  };

  return (
    <Card className="flex flex-col gap-3" animate={false}>
      <h3 className="text-xs font-mono uppercase tracking-widest text-nero-muted mb-1">System Status</h3>

      {/* Backend */}
      <div className="flex items-center justify-between">
        <StatusDot status={backendStatus} label="Backend" />
        <span className="text-xs text-nero-muted font-mono">
          {backendVersion ? `v${backendVersion}` : '—'}
        </span>
      </div>

      {/* WebSocket */}
      <div className="flex items-center justify-between">
        <StatusDot status={wsStatus} label="WebSocket" />
        <span className="text-xs text-nero-muted font-mono">
          {wsStatus === 'connected' ? 'Live' : wsStatus}
        </span>
      </div>

      {/* Divider */}
      <div className="border-t border-nero-border my-1" />

      {/* AI State */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-nero-muted">AI State</span>
        <AIStateBadge state={aiState} />
      </div>

      {/* Personality */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-nero-muted">Personality</span>
        <span className="text-xs text-nero-cyan font-mono capitalize">
          {personalityLabels[personalityMode] ?? personalityMode}
        </span>
      </div>

      {/* Last health check */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-nero-muted">Last Check</span>
        <span className="text-xs text-nero-muted font-mono">{formatTime(lastHealthCheck)}</span>
      </div>
    </Card>
  );
}
