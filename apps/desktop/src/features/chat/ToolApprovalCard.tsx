import { useState } from 'react';
import { useToolsStore } from '../../stores/toolsStore';

interface ToolApprovalCardProps {
  token: string;
  toolName: string;
}

export function ToolApprovalCard({ token, toolName }: ToolApprovalCardProps) {
  const { approveAction } = useToolsStore();
  const [status, setStatus] = useState<'pending' | 'resolved'>('pending');
  const [resolution, setResolution] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDecision = async (decision: 'allow_once' | 'always_allow' | 'deny') => {
    setIsSubmitting(true);
    const res = await approveAction(token, decision);
    setIsSubmitting(false);

    if (res.success) {
      setStatus('resolved');
      setResolution(
        decision === 'deny'
          ? 'Execution Denied'
          : decision === 'always_allow'
          ? 'Execution Allowed & Set to Always Allow'
          : 'Execution Allowed',
      );
    } else {
      setResolution(res.message || 'Action failed');
    }
  };

  if (status === 'resolved') {
    return (
      <div className="mt-3 p-3 rounded-xl bg-white/5 border border-nero-cyan/30 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-nero-cyan" />
          <span className="font-mono text-nero-text font-medium">{resolution}</span>
        </div>
        <span className="text-[10px] text-nero-muted font-mono">{toolName}</span>
      </div>
    );
  }

  return (
    <div className="mt-3 p-4 rounded-xl bg-[#090b14] border border-amber-500/30 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          <span className="text-xs font-semibold text-amber-300 font-mono tracking-wide uppercase">
            Security Permission Required
          </span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-nero-muted">
          Tool: {toolName}
        </span>
      </div>

      <p className="text-xs text-nero-muted">
        NERO requested permission to execute desktop action <strong className="text-nero-text">`{toolName}`</strong>.
      </p>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => void handleDecision('allow_once')}
          className="px-3 py-1.5 rounded-lg bg-nero-cyan text-nero-bg font-semibold text-xs hover:bg-nero-cyan/90 transition-colors shadow-sm disabled:opacity-50"
        >
          Allow Once
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => void handleDecision('always_allow')}
          className="px-3 py-1.5 rounded-lg bg-nero-cyan/15 border border-nero-cyan/40 text-nero-cyan font-medium text-xs hover:bg-nero-cyan/25 transition-colors disabled:opacity-50"
        >
          Always Allow
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => void handleDecision('deny')}
          className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 font-medium text-xs hover:bg-red-500/20 transition-colors disabled:opacity-50"
        >
          Deny
        </button>
      </div>
    </div>
  );
}
