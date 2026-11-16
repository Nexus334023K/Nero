import { motion } from 'framer-motion';
import { voiceService } from '../../services/voice';
import { ToolApprovalCard } from './ToolApprovalCard';
import type { Message } from '../../types';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

function parseApprovalToken(content: string): { token: string; toolName: string } | null {
  const match = content.match(/<!--\s*APPROVAL_TOKEN:(\S+)\s+TOOL:(\S+)\s*-->/);
  if (match && match[1] && match[2]) {
    return { token: match[1], toolName: match[2] };
  }
  return null;
}

function formatContent(content: string) {
  // Strip approval comment from displayed text
  const cleanContent = content.replace(/<!--\s*APPROVAL_TOKEN:\S+\s+TOOL:\S+\s*-->/g, '').trim();

  // Simple markdown-like formatting for code blocks
  const parts = cleanContent.split(/(```[\s\S]*?```)/g);

  return parts.map((part, index) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const lines = part.slice(3, -3).trim().split('\n');
      const lang = lines[0]?.match(/^[a-zA-Z0-9_-]+$/) ? lines[0] : '';
      const code = lang ? lines.slice(1).join('\n') : lines.join('\n');

      return (
        <div key={index} className="my-2 rounded-lg overflow-hidden border border-white/10 bg-[#07070b]">
          {lang && (
            <div className="px-3 py-1 bg-white/5 border-b border-white/5 text-[11px] font-mono text-nero-muted uppercase">
              {lang}
            </div>
          )}
          <pre className="p-3 text-xs font-mono text-nero-text overflow-x-auto whitespace-pre">
            <code>{code}</code>
          </pre>
        </div>
      );
    }

    return (
      <span key={index} className="whitespace-pre-wrap leading-relaxed">
        {part}
      </span>
    );
  });
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-[11px] font-mono text-nero-muted bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
          {message.content}
        </span>
      </div>
    );
  }

  const formattedTime = (() => {
    try {
      return new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return message.timestamp;
    }
  })();

  const approvalInfo = !isUser ? parseApprovalToken(message.content) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, x: isUser ? 10 : -10 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex flex-col mb-4 ${isUser ? 'items-end' : 'items-start'}`}
    >
      <div className="flex items-end gap-2 max-w-[80%]">
        {!isUser && (
          <div className="w-6 h-6 rounded-md bg-nero-cyan/20 border border-nero-cyan/40 flex items-center justify-center shrink-0 mb-1">
            <span className="text-[10px] font-mono font-bold text-nero-cyan">N</span>
          </div>
        )}

        <div
          className={`rounded-2xl px-4 py-2.5 text-sm ${
            isUser
              ? 'bg-nero-cyan/15 text-nero-text border border-nero-cyan/30 rounded-br-xs'
              : 'glass text-nero-text rounded-bl-xs border border-white/10'
          }`}
        >
          {message.content ? (
            <>
              {formatContent(message.content)}
              {approvalInfo && (
                <ToolApprovalCard
                  token={approvalInfo.token}
                  toolName={approvalInfo.toolName}
                />
              )}
              {isStreaming && (
                <span className="inline-block w-1.5 h-3.5 bg-nero-cyan ml-1 animate-pulse align-middle" />
              )}
            </>
          ) : (
            <div className="flex items-center gap-1.5 py-1 px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-nero-cyan animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-nero-cyan animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-nero-cyan animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-1 px-1">
        <span className="text-[10px] text-nero-muted font-mono">{formattedTime}</span>
        {message.model_used && (
          <span className="text-[9px] text-nero-muted/70 font-mono">[{message.model_used}]</span>
        )}
        {!isUser && message.content && (
          <button
            type="button"
            onClick={() => void voiceService.speak(message.content)}
            className="text-[10px] text-nero-muted hover:text-nero-cyan transition-colors flex items-center gap-1 cursor-pointer"
            title="Listen to message (Fish Audio / TTS)"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
            <span>Play</span>
          </button>
        )}
      </div>
    </motion.div>
  );
}
