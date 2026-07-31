export interface TableroDevice {
  id: number;
  name: string;
  schema_name: string;
  view_name: string;
  sede_filter: string | null;
  paired: boolean;
  active: boolean;
  pairing_code: string | null;
  pairing_expires_at: string | null;
  last_seen_at: string | null;
  last_ip: string | null;
  user_agent: string | null;
  connection_count: number;
  max_connections: number;
  created_at: string;
}

export interface CreateTableroPayload {
  name: string;
  schema_name?: string;
  view_name?: string;
  sede_filter?: string;
  max_connections?: number;
}

export interface CreateTableroResponse {
  success: boolean;
  data: {
    id: number;
    name: string;
    pairing_code: string;
    expires_in: string;
    sede_filter: string | null;
    instructions: string;
  };
}
