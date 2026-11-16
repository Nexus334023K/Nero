import { useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useToolsStore } from '../../stores/toolsStore';
import { StatusDot, AIStateBadge } from '../../components/ui/StatusIndicator';
import { Card } from '../../components/ui/Card';

export function SystemStatus() {
  const { backendStatus, wsStatus, aiState, backendVersion, lastHealthCheck, personalityMode } =
    useAppStore();
  const { systemStats, fetchSystemStats } = useToolsStore();

  useEffect(() => {
    void fetchSystemStats();
    const interval = setInterval(() => {
      void fetchSystemStats();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchSystemStats]);

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

  const cpuPct = systemStats?.cpu_percent ?? 0;
  const ramPct = systemStats?.memory?.percent ?? 0;

  return (
    <Card className="flex flex-col gap-3" animate={false}>
      <h3 className="text-xs font-mono uppercase tracking-widest text-nero-muted mb-1">
        System & Hardware Status
      </h3>

      {/* Backend & WS */}
      <div className="flex items-center justify-between">
        <StatusDot status={backendStatus} label="Backend" />
        <span className="text-xs text-nero-muted font-mono">
          {backendVersion ? `v${backendVersion}` : '—'}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <StatusDot status={wsStatus} label="WebSocket" />
        <span className="text-xs text-nero-muted font-mono">
          {wsStatus === 'connected' ? 'Live' : wsStatus}
        </span>
      </div>

      {/* Divider */}
      <div className="border-t border-nero-border my-1" />

      {/* Hardware Telemetry */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-nero-muted">CPU Usage</span>
          <span className="font-mono text-nero-cyan">{cpuPct}%</span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-nero-cyan rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, cpuPct))}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-nero-muted">RAM Usage</span>
          <span className="font-mono text-nero-cyan">
            {systemStats?.memory ? `${ramPct}% (${systemStats.memory.used_gb} GB)` : '—'}
          </span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-purple-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, ramPct))}%` }}
          />
        </div>
      </div>

      {systemStats?.uptime && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-nero-muted">Uptime</span>
          <span className="text-xs text-nero-text font-mono">
            {systemStats.uptime.formatted}
          </span>
        </div>
      )}

      {systemStats?.battery && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-nero-muted">Battery</span>
          <span className="text-xs text-nero-text font-mono">
            {systemStats.battery.percent}% {systemStats.battery.power_plugged ? '⚡ Charging' : ''}
          </span>
        </div>
      )}

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
