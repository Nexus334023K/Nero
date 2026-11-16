const BASE_URL = 'http://localhost:8765/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new ApiError(res.status, `API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: {
    get: () =>
      request<{ status: string; version: string; timestamp: string; database: string; uptime_seconds: number }>(
        '/health',
      ),
    ping: () => request<{ pong: boolean; timestamp: string }>('/health/ping'),
  },
  chat: {
    send: (message: string, conversationId?: string) =>
      request<{
        response: string;
        conversation_id: string;
        message_id: string;
        model_used: string;
        timestamp: string;
      }>('/chat', {
        method: 'POST',
        body: JSON.stringify({ message, conversation_id: conversationId }),
      }),
    getConversations: () =>
      request<{ conversations: Array<{ id: string; title: string; created_at: string }> }>(
        '/chat/conversations',
      ),
  },
};
