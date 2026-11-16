export type AIState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'executing' | 'error';

export type PersonalityMode = 'friend' | 'professional' | 'focus' | 'supportive' | 'adaptive';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  model_used?: string;
}

export interface Conversation {
  id: string;
  title: string;
  personality_mode: PersonalityMode;
  created_at: string;
  updated_at: string;
  messages?: Message[];
}

export interface SystemStatus {
  backendStatus: ConnectionStatus;
  wsStatus: ConnectionStatus;
  aiState: AIState;
  backendVersion?: string;
  lastHealthCheck?: string;
}

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}
