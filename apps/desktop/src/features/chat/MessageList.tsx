import { useEffect, useRef } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { MessageBubble } from './MessageBubble';

export function MessageList() {
  const { messages, isLoading, streamingMessageId } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, streamingMessageId]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-nero-cyan/10 border border-nero-cyan/30 flex items-center justify-center mb-3 cyan-glow-sm">
          <span className="text-nero-cyan font-mono font-bold text-lg">N</span>
        </div>
        <h2 className="text-lg font-semibold text-nero-text mb-1">Start a conversation with NERO</h2>
        <p className="text-xs text-nero-muted max-w-sm">
          Ask questions, execute workflows, brainstorm ideas, or discuss tasks with your desktop AI companion.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          isStreaming={message.id === streamingMessageId}
        />
      ))}

      {isLoading && !streamingMessageId && (
        <div className="flex items-center gap-2 text-nero-muted text-xs py-2">
          <div className="w-2 h-2 rounded-full bg-nero-cyan animate-ping" />
          <span className="font-mono">NERO is thinking...</span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
