import { create } from 'zustand';
import { api } from '../services/api';
import type { BackgroundTask, TaskCreatePayload, TaskReportResponse } from '../types/tasks';

interface TaskStoreState {
  tasks: BackgroundTask[];
  activeTaskId: string | null;
  activeTask: BackgroundTask | null;
  selectedReport: TaskReportResponse | null;
  isLoading: boolean;
  error: string | null;

  fetchTasks: (status?: string) => Promise<void>;
  fetchTask: (taskId: string) => Promise<BackgroundTask | null>;
  createTask: (payload: TaskCreatePayload) => Promise<BackgroundTask | null>;
  pauseTask: (taskId: string) => Promise<boolean>;
  resumeTask: (taskId: string) => Promise<boolean>;
  cancelTask: (taskId: string) => Promise<boolean>;
  steerTask: (taskId: string, instruction: string) => Promise<boolean>;
  finishEarlyTask: (taskId: string) => Promise<boolean>;
  retryTask: (taskId: string) => Promise<boolean>;
  fetchReport: (taskId: string) => Promise<TaskReportResponse | null>;
  deleteTask: (taskId: string) => Promise<boolean>;
  setActiveTaskId: (taskId: string | null) => void;
  clearReport: () => void;
  handleWebSocketEvent: (event: string, taskId: string, data: any) => void;
}

export const useTaskStore = create<TaskStoreState>((set, get) => ({
  tasks: [],
  activeTaskId: null,
  activeTask: null,
  selectedReport: null,
  isLoading: false,
  error: null,

  fetchTasks: async (status) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.tasks.list(status);
      set({ tasks: res.tasks, isLoading: false });
      const currentActiveId = get().activeTaskId;
      if (currentActiveId) {
        const found = res.tasks.find((t) => t.id === currentActiveId);
        if (found) set({ activeTask: found });
      }
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch tasks',
      });
    }
  },

  fetchTask: async (taskId) => {
    try {
      const task = await api.tasks.get(taskId);
      set((state) => ({
        activeTask: task,
        tasks: state.tasks.some((t) => t.id === task.id)
          ? state.tasks.map((t) => (t.id === task.id ? task : t))
          : [task, ...state.tasks],
      }));
      return task;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch task details' });
      return null;
    }
  },

  createTask: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const task = await api.tasks.create(payload);
      set((state) => ({
        tasks: [task, ...state.tasks],
        activeTaskId: task.id,
        activeTask: task,
        isLoading: false,
      }));
      return task;
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to create background task',
      });
      return null;
    }
  },

  pauseTask: async (taskId) => {
    try {
      await api.tasks.pause(taskId);
      await get().fetchTask(taskId);
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to pause task' });
      return false;
    }
  },

  resumeTask: async (taskId) => {
    try {
      await api.tasks.resume(taskId);
      await get().fetchTask(taskId);
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to resume task' });
      return false;
    }
  },

  cancelTask: async (taskId) => {
    try {
      await api.tasks.cancel(taskId);
      await get().fetchTask(taskId);
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to cancel task' });
      return false;
    }
  },

  steerTask: async (taskId, instruction) => {
    try {
      await api.tasks.steer(taskId, instruction);
      await get().fetchTask(taskId);
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to steer task' });
      return false;
    }
  },

  finishEarlyTask: async (taskId) => {
    try {
      await api.tasks.finishEarly(taskId);
      await get().fetchTask(taskId);
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to initiate early finish' });
      return false;
    }
  },

  retryTask: async (taskId) => {
    try {
      await api.tasks.retry(taskId);
      await get().fetchTask(taskId);
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to retry task' });
      return false;
    }
  },

  fetchReport: async (taskId) => {
    try {
      const rep = await api.tasks.getReport(taskId);
      set({ selectedReport: rep });
      return rep;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch report' });
      return null;
    }
  },

  deleteTask: async (taskId) => {
    try {
      await api.tasks.delete(taskId);
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== taskId),
        activeTaskId: state.activeTaskId === taskId ? null : state.activeTaskId,
        activeTask: state.activeTaskId === taskId ? null : state.activeTask,
        selectedReport: state.selectedReport?.task_id === taskId ? null : state.selectedReport,
      }));
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete task' });
      return false;
    }
  },

  setActiveTaskId: (taskId) => {
    const task = get().tasks.find((t) => t.id === taskId) || null;
    set({ activeTaskId: taskId, activeTask: task });
    if (taskId && !task) {
      get().fetchTask(taskId);
    }
  },

  clearReport: () => set({ selectedReport: null }),

  handleWebSocketEvent: (_event, taskId, _data) => {
    // If event corresponds to currently active task, re-fetch or patch in place
    if (taskId === get().activeTaskId) {
      get().fetchTask(taskId);
    } else {
      get().fetchTasks();
    }
  },
}));
