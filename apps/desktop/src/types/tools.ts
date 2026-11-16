export interface MemoryStats {
  total_gb: number;
  used_gb: number;
  available_gb: number;
  percent: number;
}

export interface BatteryStats {
  percent: number;
  power_plugged: boolean;
  secs_left: number | null;
}

export interface DiskStats {
  device: string;
  mountpoint: string;
  total_gb: number;
  used_gb: number;
  free_gb: number;
  percent: number;
}

export interface UptimeStats {
  seconds: number;
  formatted: string;
}

export interface PlatformStats {
  system: string;
  release: string;
  machine: string;
}

export interface SystemStats {
  timestamp: string;
  cpu_percent: number;
  memory: MemoryStats;
  battery: BatteryStats | null;
  disks: DiskStats[];
  uptime: UptimeStats;
  platform: PlatformStats;
}

export interface DesktopApp {
  id: string;
  name: string;
  description: string;
  category: 'productivity' | 'utility' | 'system' | 'developer' | 'browser';
  is_installed: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  permission_level: 'auto' | 'permission_required' | 'explicit_confirmation';
  parameters_schema: Record<string, unknown>;
  configured_permission: 'auto' | 'permission_required' | 'explicit_confirmation';
  is_enabled: boolean;
}

export interface PendingApproval {
  token: string;
  tool_name: string;
  params: Record<string, unknown>;
  permission_level: string;
  reason: string;
  created_at: string;
  expires_at: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
}

export interface ToolExecutionResult {
  status: 'success' | 'error' | 'approval_required';
  tool: string;
  message?: string;
  result?: {
    success: boolean;
    action_taken: string;
    output?: unknown;
    error?: string;
    metadata?: Record<string, unknown>;
  };
  approval?: PendingApproval;
}
