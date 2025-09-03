import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Configure Supabase client with improved session management
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
    // Improve session storage
    storage: {
      getItem: (key: string) => {
        try {
          return localStorage.getItem(key)
        } catch {
          return null
        }
      },
      setItem: (key: string, value: string) => {
        try {
          localStorage.setItem(key, value)
        } catch {
          // Ignore errors
        }
      },
      removeItem: (key: string) => {
        try {
          localStorage.removeItem(key)
        } catch {
          // Ignore errors
        }
      }
    }
  },
  global: {
    headers: {
      'X-Client-Info': 'better-excel-web-app'
    }
  }
})

// Database types based on the schema
export interface Project {
  id: string
  user_id?: string
  name: string
  description?: string
  created_at: string
  updated_at?: string
  is_deleted?: boolean
  deleted_at?: string
  settings?: any
}

export interface BetterTable {
  id: string
  name: string
  project_id: string
  created_at: string
  updated_at: string
  is_deleted?: boolean
  deleted_at?: string
  description?: string
  table_schema?: string
  row_count?: number
  primary_column_id?: string
}

export interface BetterSheet {
  id: string
  name: string
  table_id: string
  created_at: string
  updated_at: string
  is_deleted?: boolean
  deleted_at?: string
  is_favorite?: boolean
  last_opened_at?: string
  description?: string
  view_config?: any
}

export interface RollupConfiguration {
  id: string; // The unique ID of the configuration record itself
  column_id: string; // The ID of the rollup column this configuration applies to
  source_link_column_id: string; // The ID of the 'Link' column in the same table
  source_field_column_id: string; // The ID of the column in the linked table to perform calculations on
  aggregation_function: string; // e.g., 'sum', 'average', 'count'
  user_id: string;
  created_at: string;
}
export interface Column {
  id: string
  sheet_id?: string
  user_id: string
  name: string
  data_type: string
  is_required?: boolean
  default_value?: string
  column_order?: number
  created_at: string
  updated_at?: string
  is_deleted?: boolean
  is_unique?: boolean
  link_config?: any
  rollup_config?: any
  validation_rules?: {
    min?: number
    max?: number
    pattern?: string
    [key: string]: any
  }
  display_settings?: any
  formula?: string
  table_id?: string
  type?: string
  position?: number
  config?: any
  required?: boolean
  ui_origin_metadata?: any
}

export interface Row {
  id: string
  sheet_id: string
  row_data: any
  row_order?: number
  created_at: string
  updated_at: string
  is_deleted?: boolean
}

export interface LinkConfiguration {
  id: string
  column_id: string
  target_table_id: string
  display_column_id?: string
  created_at: string
  updated_at: string
  user_id: string
}

// Add this interface to your /src/lib/supabase.ts file

export interface SelectOption {
  id: string; // This is the UUID of the option record itself
  column_id: string;
  option_value: string; // e.g., 'in_progress'
  option_label: string; // e.g., 'In Progress'
  option_order: number;
  is_active: boolean;
  user_id: string;
  created_at?: string;
  updated_at?: string;
  color?: string;  
  [key: string]: any;
}

export interface AutomationRule {
  rule_type: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'greater_equal' | 'less_equal';
  condition_value: string;
  result_value: string;
  rule_order: number;
  strict_mode: boolean;
}

export interface AutomatedColumnConfig {
  id: string;
  column_id: string;
  source_column_id?: string;
  default_value?: string;
  rules: AutomationRule[];
}

export interface AvailableColumn {
  project_id: string;
  project_name: string;
  table_id: string;
  table_name: string;
  sheet_id: string;
  sheet_name: string;
  column_id: string;
  column_name: string;
  data_type: string;
}

// --- FIX #2: Add a specific type for the update payload ---
export interface UpdateAutomatedColumnConfigPayload {
    source_column_id?: string;
    default_value?: string;
    rules: Partial<AutomationRule>[];
}

