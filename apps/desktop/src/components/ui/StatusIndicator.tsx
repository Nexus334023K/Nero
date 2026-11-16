import type { ConnectionStatus, AIState } from '../../types';

interface StatusDotProps {
  status: ConnectionStatus;
  label?: string;
}

export function StatusDot({ status, label }: StatusDotProps) {
  const colors: Record<ConnectionStatus, string> = {
    connected: 'bg-green-400 shadow-[0_0_6px_#10b981]',
    connecting: 'bg-yellow-400 animate-pulse',
    disconnected: 'bg-slate-500',
    error: 'bg-red-500 shadow-[0_0_6px_#ef4444]',
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${colors[status]}`} />
      {label && <span className="text-xs text-nero-muted">{label}</span>}
    </div>
  );
}

interface AIStateBadgeProps {
  state: AIState;
}

export function AIStateBadge({ state }: AIStateBadgeProps) {
  const config: Record<AIState, { color: string; label: string; pulse: boolean }> = {
    idle: { color: 'text-slate-400', label: 'Idle', pulse: false },
    listening: { color: 'text-yellow-400', label: 'Listening', pulse: true },
    thinking: { color: 'text-cyan-400', label: 'Thinking', pulse: true },
    speaking: { color: 'text-green-400', label: 'Speaking', pulse: true },
    executing: { color: 'text-blue-400', label: 'Executing', pulse: true },
    error: { color: 'text-red-400', label: 'Error', pulse: false },
  };

  const { color, label, pulse } = config[state];

  return (
    <span className={`text-xs font-mono uppercase tracking-widest ${color} ${pulse ? 'animate-pulse' : ''}`}>
      {label}
    </span>
  );
}
