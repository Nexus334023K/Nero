import { useEffect } from 'react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useChatStore } from '../../stores/chatStore';
import { api } from '../../services/api';

export function ChatView() {
  const { setConversations } = useChatStore();

  useEffect(() => {
    let mounted = true;
    api.chat.getConversations()
      .then((res) => {
        if (mounted && res?.conversations) {
          setConversations(
            res.conversations.map((c) => ({
              id: c.id,
              title: c.title,
              personality_mode: 'adaptive',
              created_at: c.created_at,
              updated_at: c.created_at,
            }))
          );
        }
      })
      .catch(() => {
        // Silently catch if backend not initialized yet
      });

    return () => {
      mounted = false;
    };
  }, [setConversations]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-nero-bg">
      <div className="h-12 px-6 flex items-center justify-between border-b border-nero-border glass shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-nero-text">Chat Session</span>
          <span className="text-xs text-nero-muted font-mono">/ Live</span>
        </div>
      </div>
      <MessageList />
      <MessageInput />
    </div>
  );
}
