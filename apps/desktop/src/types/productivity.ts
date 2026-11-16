export interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  project_id?: string | null;
  due_date?: string | null;
  created_at: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  description?: string | null;
  root_path?: string | null;
  status: 'active' | 'archived' | 'completed';
  created_at: string;
}

export interface DailyBriefing {
  greeting: string;
  date: string;
  formatted_date: string;
  pending_tasks_count: number;
  urgent_tasks_count: number;
  active_projects_count: number;
  top_tasks: Array<{ id: string; title: string; priority: string }>;
}

export interface WebSearchResultItem {
  title: string;
  snippet: string;
  url: string;
}

export interface WebSearchResults {
  query: string;
  total_results: number;
  results: WebSearchResultItem[];
}

export interface GitStatusInfo {
  repo_path: string;
  branch: string;
  is_clean: boolean;
  changed_files_count: number;
  changed_files: string[];
}

export interface ProjectStructureInfo {
  project_name: string;
  project_path: string;
  tech_stack: string[];
  total_files: number;
  total_directories: number;
  top_extensions: Record<string, number>;
}
