export type TaskStatus =
  | 'queued'
  | 'planning'
  | 'running'
  | 'waiting'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TaskStep {
  step_number: number;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  output?: string;
  started_at?: string;
  completed_at?: string;
}

export interface BackgroundTask {
  id: string;
  user_id: string;
  request: string;
  title: string;
  assigned_agent: string;
  status: TaskStatus;
  current_step: number;
  total_steps: number;
  progress: number;
  plan?: TaskStep[];
  step_results?: any[];
  checkpoint?: any;
  steering_instructions?: Array<{ instruction: string; timestamp?: string } | string>;
  error_info?: string | null;
  final_result?: string | null;
  report_path?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskProgress {
  task_id: string;
  status: TaskStatus;
  progress: number;
  current_step: number;
  total_steps: number;
  current_step_title?: string | null;
  updated_at: string;
}

export interface TaskCreatePayload {
  request: string;
  title?: string;
  assigned_agent?: 'general' | 'research';
}

export interface TaskReportResponse {
  task_id: string;
  title: string;
  report_markdown: string;
  report_path?: string | null;
}
