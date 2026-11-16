import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useAppStore } from '../../stores/appStore';
import { api } from '../../services/api';
import type { Message } from '../../types';

export function MessageInput() {
  const [content, setContent] = useState('');
  const { activeConversationId, addMessage, isLoading, setIsLoading } = useChatStore();
  const { setAIState } = useAppStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollH = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollH, 140)}px`;
    }
  }, [content]);

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    addMessage(userMessage);
    setContent('');
    setIsLoading(true);
    setAIState('thinking');

    try {
      const res = await api.chat.send(trimmed, activeConversationId || undefined);
      const assistantMessage: Message = {
        id: res.message_id || `asst-${Date.now()}`,
        role: 'assistant',
        content: res.response,
        timestamp: res.timestamp || new Date().toISOString(),
        model_used: res.model_used,
      };
      addMessage(assistantMessage);
      setAIState('idle');
    } catch {
      const errorMessage: Message = {
        id: `err-${Date.now()}`,
        role: 'system',
        content: 'Failed to communicate with NERO backend. Please ensure the backend is running.',
        timestamp: new Date().toISOString(),
      };
      addMessage(errorMessage);
      setAIState('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="p-4 border-t border-nero-border glass shrink-0">
      <div className="flex items-end gap-2 bg-[#07070c] border border-white/10 rounded-xl px-3 py-2 focus-within:border-nero-cyan/50 transition-colors">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask NERO anything... (Enter to send, Shift+Enter for newline)"
          rows={1}
          disabled={isLoading}
          className="flex-1 bg-transparent resize-none outline-none text-sm text-nero-text placeholder:text-nero-muted max-h-36 py-1"
        />

        {/* Microphone placeholder button */}
        <div className="relative group">
          <button
            type="button"
            className="p-2 text-nero-muted hover:text-nero-text rounded-lg hover:bg-white/5 transition-colors disabled:opacity-40"
            disabled={isLoading}
            title="Voice coming soon"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-[#11111a] border border-white/10 text-[10px] text-nero-text px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none z-10">
            Voice coming soon
          </div>
        </div>

        {/* Send button */}
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!content.trim() || isLoading}
          className="p-2 rounded-lg bg-nero-cyan text-nero-bg hover:brightness-110 disabled:opacity-30 disabled:hover:brightness-100 transition-all cyan-glow-sm"
          title="Send message"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
