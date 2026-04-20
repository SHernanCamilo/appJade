export interface ScheduledTask {
  id: number;
  name: string;
  type: TaskType;
  type_name: string;
  type_description: string;
  status: TaskStatus;
  status_label: string;
  description?: string;
  parameters?: Record<string, any>;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  attempts: number;
  max_attempts: number;
  can_retry: boolean;
  is_overdue: boolean;
  duration?: number;
  duration_formatted?: string;
  result?: string;
  error_message?: string;
  job_id?: number;
  created_by?: number;
  creator?: TaskCreator;
  created_at: string;
  updated_at: string;
}

export interface TaskCreator {
  id: number;
  name: string;
  email: string;
}

export type TaskType = 
  | 'sync_activos' 
  | 'cierre_automatico' 
  | 'mantenimiento_db' 
  | 'envio_reportes';

export type TaskStatus = 
  | 'pending' 
  | 'running' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';

export interface TaskTypeConfig {
  key: TaskType;
  name: string;
  description: string;
  max_attempts: number;
  timeout: number;
  parameters: Record<string, string>;
}

export interface TaskStats {
  pending: number;
  running: number;
  completed_today: number;
  failed_today: number;
  total: number;
  by_type: Record<string, number>;
  recent_failures: ScheduledTask[];
}

export interface CreateTaskRequest {
  name: string;
  type: TaskType;
  description?: string;
  scheduled_at?: string;
  parameters?: Record<string, any>;
  max_attempts?: number;
}

export interface UpdateTaskRequest {
  name?: string;
  description?: string;
  scheduled_at?: string;
  parameters?: Record<string, any>;
}

export interface TaskListParams {
  status?: TaskStatus;
  type?: TaskType;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface TaskListResponse {
  data: ScheduledTask[];
  meta: {
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
    from: number;
    to: number;
  };
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
}
