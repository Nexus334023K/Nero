import { create } from 'zustand';
import { api } from '../services/api';
import type { TaskItem, ProjectItem, DailyBriefing } from '../types/productivity';

interface ProductivityState {
  tasks: TaskItem[];
  projects: ProjectItem[];
  briefing: DailyBriefing | null;
  isLoading: boolean;
  error: string | null;

  fetchTasks: (status?: string) => Promise<void>;
  fetchProjects: () => Promise<void>;
  fetchBriefing: () => Promise<void>;
  createTask: (
    title: string,
    priority?: TaskItem['priority'],
    description?: string,
    projectId?: string,
  ) => Promise<boolean>;
  toggleTaskComplete: (taskId: string, currentStatus: string) => Promise<boolean>;
  deleteTask: (taskId: string) => Promise<boolean>;
  createProject: (name: string, description?: string, rootPath?: string) => Promise<boolean>;
  deleteProject: (projectId: string) => Promise<boolean>;
}

export const useProductivityStore = create<ProductivityState>((set, get) => ({
  tasks: [],
  projects: [],
  briefing: null,
  isLoading: false,
  error: null,

  fetchTasks: async (status) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.productivity.listTasks(status ? { status } : undefined);
      set({ tasks: res.tasks, isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch tasks',
      });
    }
  },

  fetchProjects: async () => {
    try {
      const res = await api.productivity.listProjects();
      set({ projects: res.projects });
    } catch {
      // Graceful fallback
    }
  },

  fetchBriefing: async () => {
    try {
      const res = await api.productivity.getBriefing();
      set({ briefing: res });
    } catch {
      // Graceful fallback
    }
  },

  createTask: async (title, priority = 'medium', description, projectId) => {
    try {
      await api.productivity.createTask({
        title,
        priority,
        description,
        project_id: projectId,
      });
      await get().fetchTasks();
      void get().fetchBriefing();
      return true;
    } catch {
      return false;
    }
  },

  toggleTaskComplete: async (taskId, currentStatus) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      await api.productivity.updateTask(taskId, { status: newStatus as TaskItem['status'] });
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === taskId ? { ...t, status: newStatus as TaskItem['status'] } : t,
        ),
      }));
      void get().fetchBriefing();
      return true;
    } catch {
      return false;
    }
  },

  deleteTask: async (taskId) => {
    try {
      await api.productivity.deleteTask(taskId);
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== taskId),
      }));
      void get().fetchBriefing();
      return true;
    } catch {
      return false;
    }
  },

  createProject: async (name, description, rootPath) => {
    try {
      await api.productivity.createProject({
        name,
        description,
        root_path: rootPath,
      });
      await get().fetchProjects();
      return true;
    } catch {
      return false;
    }
  },

  deleteProject: async (projectId) => {
    try {
      await api.productivity.deleteProject(projectId);
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== projectId),
      }));
      return true;
    } catch {
      return false;
    }
  },
}));
