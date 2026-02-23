export interface Template {
  id: number;
  name: string;
  category: string;
  content: string;
  variables?: string[];
  created_at: Date;
  updated_at: Date;
  created_by: number;
  creator?: {
    id: number;
    name: string;
    email: string;
  };
}

export interface CreateTemplateDto {
  name: string;
  category: string;
  content: string;
}

export interface UpdateTemplateDto {
  name?: string;
  category?: string;
  content?: string;
}

export interface Variable {
  name: string;
  displayName: string;
  description: string;
  type: 'string' | 'number' | 'date' | 'email' | 'phone';
  required: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  variable?: string;
}

export interface DocumentGenerationRequest {
  templateId: number;
  variables: Record<string, any>;
  outputFormat: 'pdf' | 'html';
  options?: GenerationOptions;
}

export interface GenerationOptions {
  filename?: string;
  pageSize?: 'A4' | 'Letter';
  orientation?: 'portrait' | 'landscape';
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    path: string;
  };
}
