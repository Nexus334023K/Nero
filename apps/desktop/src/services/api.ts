import type {
  SystemStats,
  DesktopApp,
  ToolDefinition,
  PendingApproval,
  ToolExecutionResult,
} from '../types/tools';
import type { TaskItem, ProjectItem, DailyBriefing } from '../types/productivity';

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

export interface StreamDonePayload {
  type: string;
  conversation_id: string;
  message_id: string;
  model_used: string;
  response: string;
  timestamp: string;
}

export interface ProviderItem {
  name: string;
  provider_type: 'cloud' | 'local';
  default_model: string;
  is_configured: boolean;
  is_active: boolean;
}

export interface ProviderListResponse {
  providers: ProviderItem[];
  active_provider: string;
}

export interface PersonalityModesResponse {
  active_mode: string;
  modes: string[];
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
    send: (message: string, conversationId?: string, personalityMode: string = 'adaptive') =>
      request<{
        response: string;
        conversation_id: string;
        message_id: string;
        model_used: string;
        timestamp: string;
      }>('/chat', {
        method: 'POST',
        body: JSON.stringify({ message, conversation_id: conversationId, personality_mode: personalityMode }),
      }),
    sendStream: async (
      message: string,
      conversationId: string | undefined,
      personalityMode: string,
      onChunk: (chunk: string) => void,
      onDone: (data: StreamDonePayload) => void,
      onError: (err: unknown) => void,
    ): Promise<void> => {
      try {
        const response = await fetch(`${BASE_URL}/chat/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            conversation_id: conversationId || null,
            personality_mode: personalityMode,
          }),
        });

        if (!response.ok) {
          throw new ApiError(response.status, `Stream error: ${response.status} ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const dataStr = trimmed.slice(6);
            if (!dataStr) continue;

            try {
              const payload = JSON.parse(dataStr);
              if (payload.type === 'chunk' && payload.content) {
                onChunk(payload.content);
              } else if (payload.chunk) {
                onChunk(payload.chunk);
              } else if (payload.type === 'error') {
                onError(new Error(payload.error || 'Stream error'));
              } else if (payload.type === 'done' || payload.done) {
                onDone(payload as StreamDonePayload);
              }
            } catch {
              // Ignore invalid JSON chunks
            }
          }
        }
      } catch (err) {
        onError(err);
      }
    },
    getConversations: () =>
      request<{ conversations: Array<{ id: string; title: string; personality_mode?: string; created_at: string; updated_at?: string }> }>(
        '/chat/conversations',
      ),
  },
  providers: {
    list: () => request<ProviderListResponse>('/providers'),
    test: (data: { provider: string }) =>
      request<{ status: string; provider: string; success: boolean; latency_ms?: number; message?: string }>(
        '/providers/test',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      ),
    saveConfig: (data: {
      provider: string;
      api_key?: string;
      model?: string;
      base_url?: string;
      is_active?: boolean;
    }) =>
      request<{
        status: string;
        provider: string;
        is_configured: boolean;
        is_active: boolean;
        model: string;
      }>('/providers/config', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  personality: {
    getModes: () => request<PersonalityModesResponse>('/personality/modes'),
    setMode: (mode: string) =>
      request<{ status: string; active_mode: string }>('/personality/mode', {
        method: 'POST',
        body: JSON.stringify({ mode }),
      }),
  },
  voice: {
    tts: async (text: string, provider?: string, voiceId?: string, speed: number = 1.0): Promise<Blob> => {
      const res = await fetch(`${BASE_URL}/voice/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, provider, voice_id: voiceId, speed }),
      });
      if (!res.ok) {
        throw new ApiError(res.status, `TTS error: ${res.status} ${res.statusText}`);
      }
      return res.blob();
    },
    stt: async (audioBlob: Blob): Promise<{ text: string; confidence: number; language: string; duration_seconds: number }> => {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.wav');
      const res = await fetch(`${BASE_URL}/voice/stt`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        throw new ApiError(res.status, `STT error: ${res.status} ${res.statusText}`);
      }
      return res.json();
    },
    getSettings: () =>
      request<{
        tts_provider: string;
        stt_provider: string;
        wake_word_enabled: boolean;
        wake_word: string;
        fish_audio_api_key?: string;
        fish_audio_reference_id?: string;
        elevenlabs_api_key?: string;
        elevenlabs_voice_id?: string;
        piper_voice: string;
        speed: number;
      }>('/voice/settings'),
    updateSettings: (settings: Record<string, unknown>) =>
      request<{
        tts_provider: string;
        stt_provider: string;
        wake_word_enabled: boolean;
        wake_word: string;
        fish_audio_api_key?: string;
        fish_audio_reference_id?: string;
        elevenlabs_api_key?: string;
        elevenlabs_voice_id?: string;
        piper_voice: string;
        speed: number;
      }>('/voice/settings', {
        method: 'POST',
        body: JSON.stringify(settings),
      }),
    getVoices: () =>
      request<{
        voices: Array<{
          id: string;
          name: string;
          provider: string;
          language: string;
          description?: string;
        }>;
      }>('/voice/voices'),
    checkWakeword: (text: string) =>
      request<{ detected: boolean; target: string }>('/voice/wakeword/check', {
        method: 'POST',
        body: JSON.stringify({ text }),
      }),
  },
  memory: {
    list: (params?: { memory_type?: string; search?: string; limit?: number }) => {
      const queryParams = new URLSearchParams();
      if (params?.memory_type) queryParams.set('memory_type', params.memory_type);
      if (params?.search) queryParams.set('search', params.search);
      if (params?.limit) queryParams.set('limit', params.limit.toString());
      const qs = queryParams.toString();
      return request<{
        memories: Array<{
          id: string;
          content: string;
          importance: number;
          memory_type: string;
          tags: string[];
          created_at: string;
          accessed_at?: string;
        }>;
        count: number;
      }>(`/memory${qs ? `?${qs}` : ''}`);
    },
    create: (data: { content: string; memory_type?: string; importance?: number; tags?: string[] }) =>
      request<{
        id: string;
        content: string;
        importance: number;
        memory_type: string;
        tags: string[];
        created_at: string;
      }>('/memory', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: boolean; id: string }>(`/memory/${id}`, {
        method: 'DELETE',
      }),
    search: (query: string, limit: number = 5, memory_type?: string) =>
      request<{
        results: Array<{ id: string; content: string; score: number; metadata: Record<string, unknown> }>;
        query: string;
      }>('/memory/search', {
        method: 'POST',
        body: JSON.stringify({ query, limit, memory_type }),
      }),
    clear: () =>
      request<{ success: boolean; message: string }>('/memory/clear', {
        method: 'POST',
      }),
    stats: () =>
      request<{
        total_memories: number;
        long_term_count: number;
        episodic_count: number;
        vector_store_ready: boolean;
        memory_enabled: boolean;
      }>('/memory/stats'),
  },
  tools: {
    list: () => request<{ tools: ToolDefinition[] }>('/tools'),
    getApps: () => request<{ apps: DesktopApp[] }>('/tools/apps'),
    getSystemStats: () => request<SystemStats>('/tools/system/stats'),
    getPendingApprovals: () => request<{ pending_approvals: PendingApproval[] }>('/tools/pending-approvals'),
    execute: (toolName: string, params: Record<string, unknown> = {}, approvalToken?: string) =>
      request<ToolExecutionResult>('/tools/execute', {
        method: 'POST',
        body: JSON.stringify({
          tool_name: toolName,
          params,
          approval_token: approvalToken || null,
        }),
      }),
    approve: (token: string, decision: 'allow_once' | 'always_allow' | 'deny') =>
      request<{
        status: string;
        decision: string;
        token: string;
        tool?: string;
        execution?: ToolExecutionResult;
      }>('/tools/approve', {
        method: 'POST',
        body: JSON.stringify({ token, decision }),
      }),
    updatePermission: (toolName: string, permissionLevel: string, isEnabled: boolean = true) =>
      request<{ tool_name: string; permission_level: string; is_enabled: boolean }>(
        `/tools/${toolName}/permission`,
        {
          method: 'PUT',
          body: JSON.stringify({ permission_level: permissionLevel, is_enabled: isEnabled }),
        },
      ),
  },
  productivity: {
    listTasks: (params?: { status?: string; priority?: string; project_id?: string }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set('status', params.status);
      if (params?.priority) q.set('priority', params.priority);
      if (params?.project_id) q.set('project_id', params.project_id);
      const qs = q.toString();
      return request<{ tasks: TaskItem[] }>(`/productivity/tasks${qs ? `?${qs}` : ''}`);
    },
    createTask: (data: {
      title: string;
      description?: string;
      priority?: string;
      project_id?: string;
      due_date?: string;
    }) =>
      request<{ success: boolean; task: TaskItem }>('/productivity/tasks', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateTask: (taskId: string, data: Partial<TaskItem>) =>
      request<{ success: boolean; task: TaskItem }>(`/productivity/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    deleteTask: (taskId: string) =>
      request<{ success: boolean; id: string }>(`/productivity/tasks/${taskId}`, {
        method: 'DELETE',
      }),
    listProjects: () => request<{ projects: ProjectItem[] }>('/productivity/projects'),
    createProject: (data: { name: string; description?: string; root_path?: string }) =>
      request<{ success: boolean; project: ProjectItem }>('/productivity/projects', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    deleteProject: (projectId: string) =>
      request<{ success: boolean; id: string }>(`/productivity/projects/${projectId}`, {
        method: 'DELETE',
      }),
    getBriefing: () => request<DailyBriefing>('/productivity/briefing'),
  },
};
