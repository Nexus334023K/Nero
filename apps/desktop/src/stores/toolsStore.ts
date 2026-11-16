import { create } from 'zustand';
import { api } from '../services/api';
import type {
  SystemStats,
  DesktopApp,
  ToolDefinition,
  PendingApproval,
  ToolExecutionResult,
} from '../types/tools';

interface ToolsState {
  systemStats: SystemStats | null;
  tools: ToolDefinition[];
  availableApps: DesktopApp[];
  pendingApprovals: PendingApproval[];
  isLoadingStats: boolean;
  isLoadingTools: boolean;
  error: string | null;

  // Actions
  fetchSystemStats: () => Promise<void>;
  fetchTools: () => Promise<void>;
  fetchApps: () => Promise<void>;
  fetchPendingApprovals: () => Promise<void>;
  executeTool: (
    toolName: string,
    params?: Record<string, unknown>,
    approvalToken?: string,
  ) => Promise<ToolExecutionResult>;
  approveAction: (
    token: string,
    decision: 'allow_once' | 'always_allow' | 'deny',
  ) => Promise<{ success: boolean; message?: string }>;
  updateToolPermission: (
    toolName: string,
    permissionLevel: string,
    isEnabled?: boolean,
  ) => Promise<boolean>;
}

export const useToolsStore = create<ToolsState>((set, get) => ({
  systemStats: null,
  tools: [],
  availableApps: [],
  pendingApprovals: [],
  isLoadingStats: false,
  isLoadingTools: false,
  error: null,

  fetchSystemStats: async () => {
    try {
      const stats = await api.tools.getSystemStats();
      set({ systemStats: stats });
    } catch {
      // Keep silent for background polling
    }
  },

  fetchTools: async () => {
    set({ isLoadingTools: true, error: null });
    try {
      const res = await api.tools.list();
      set({ tools: res.tools, isLoadingTools: false });
    } catch (err) {
      set({
        isLoadingTools: false,
        error: err instanceof Error ? err.message : 'Failed to fetch tools catalog',
      });
    }
  },

  fetchApps: async () => {
    try {
      const res = await api.tools.getApps();
      set({ availableApps: res.apps });
    } catch {
      // Gracefully handle app list error
    }
  },

  fetchPendingApprovals: async () => {
    try {
      const res = await api.tools.getPendingApprovals();
      set({ pendingApprovals: res.pending_approvals });
    } catch {
      // Ignore background error
    }
  },

  executeTool: async (toolName, params = {}, approvalToken) => {
    try {
      const result = await api.tools.execute(toolName, params, approvalToken);
      if (result.status === 'approval_required' && result.approval) {
        set((state) => ({
          pendingApprovals: [
            ...state.pendingApprovals.filter((a) => a.token !== result.approval?.token),
            result.approval!,
          ],
        }));
      }
      return result;
    } catch (err) {
      return {
        status: 'error',
        tool: toolName,
        message: err instanceof Error ? err.message : 'Execution failed',
      };
    }
  },

  approveAction: async (token, decision) => {
    try {
      await api.tools.approve(token, decision);
      set((state) => ({
        pendingApprovals: state.pendingApprovals.filter((a) => a.token !== token),
      }));
      // Refresh system stats & tools state after execution
      void get().fetchSystemStats();
      void get().fetchTools();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Approval resolution failed',
      };
    }
  },

  updateToolPermission: async (toolName, permissionLevel, isEnabled = true) => {
    try {
      await api.tools.updatePermission(toolName, permissionLevel, isEnabled);
      set((state) => ({
        tools: state.tools.map((t) =>
          t.name === toolName
            ? {
                ...t,
                configured_permission: permissionLevel as ToolDefinition['permission_level'],
                is_enabled: isEnabled,
              }
            : t,
        ),
      }));
      return true;
    } catch {
      return false;
    }
  },
}));
