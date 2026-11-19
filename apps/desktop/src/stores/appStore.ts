import { create } from 'zustand';
import type { AIState, ConnectionStatus, PersonalityMode } from '../types';
import { crossWindowSync } from '../services/crossWindowSync';

interface AppStore {
  // AI state
  aiState: AIState;
  setAIState: (state: AIState) => void;

  // Backend connection
  backendStatus: ConnectionStatus;
  setBackendStatus: (status: ConnectionStatus) => void;
  backendVersion: string | null;
  setBackendVersion: (v: string) => void;

  // WebSocket
  wsStatus: ConnectionStatus;
  setWsStatus: (status: ConnectionStatus) => void;

  // Personality
  personalityMode: PersonalityMode;
  setPersonalityMode: (mode: PersonalityMode) => void;

  // UI
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Health
  lastHealthCheck: string | null;
  setLastHealthCheck: (ts: string) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  aiState: 'idle',
  setAIState: (aiState) => {
    set({ aiState });
    crossWindowSync.broadcast({ type: 'AI_STATE', payload: aiState });
  },

  backendStatus: 'connecting',
  setBackendStatus: (backendStatus) => set({ backendStatus }),
  backendVersion: null,
  setBackendVersion: (backendVersion) => set({ backendVersion }),

  wsStatus: 'disconnected',
  setWsStatus: (wsStatus) => set({ wsStatus }),

  personalityMode: 'adaptive',
  setPersonalityMode: (personalityMode) => set({ personalityMode }),

  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  lastHealthCheck: null,
  setLastHealthCheck: (lastHealthCheck) => set({ lastHealthCheck }),
}));
