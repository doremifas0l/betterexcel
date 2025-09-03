import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

interface ColumnReference {
  project_id: string
  project_name: string
  table_id: string
  table_name: string
  sheet_id: string
  sheet_name: string
  column_id: string
  column_name: string
  data_type: string
  mode: 'manual' | 'automatic'
  is_current_sheet?: boolean
  is_current_table?: boolean
  is_current_project?: boolean
}

interface HierarchicalStructure {
  project_id: string
  project_name: string
  tables: {
    table_id: string
    table_name: string
    sheets: {
      sheet_id: string
      sheet_name: string
      columns: {
        column_id: string
        column_name: string
        data_type: string
        mode: 'manual' | 'automatic'
      }[]
    }[]
  }[]
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'false'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      user_id, 
      current_project_id, 
      current_sheet_id,
      format = 'flat' // 'flat' or 'hierarchical'
    } = await req.json();

    if (!user_id) {
      throw new Error('Missing required parameter: user_id');
    }

    // Get all projects for the user
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('user_id', user_id)
      .eq('is_deleted', false)
      .order('name');

    if (projectsError) {
      throw projectsError;
    }

    if (format === 'hierarchical') {
      // Return hierarchical structure for tree view
      const hierarchicalData: HierarchicalStructure[] = [];

      for (const project of projects || []) {
        const projectData: HierarchicalStructure = {
          project_id: project.id,
          project_name: project.name,
          tables: []
        };

        // Get tables for the project
        const { data: tables, error: tablesError } = await supabase
          .from('better_tables')
          .select('id, name')
          .eq('project_id', project.id)
          .eq('user_id', user_id)
          .eq('is_deleted', false)
          .order('name');

        if (tablesError) {
          console.warn(`Error fetching tables for project ${project.id}:`, tablesError);
          continue;
        }

        for (const table of tables || []) {
          const tableData = {
            table_id: table.id,
            table_name: table.name,
            sheets: [] as any[]
          };

          // Get sheets for the table
          const { data: sheets, error: sheetsError } = await supabase
            .from('better_sheets')
            .select('id, name')
            .eq('table_id', table.id)
            .eq('user_id', user_id)
            .eq('is_deleted', false)
            .order('name');

          if (sheetsError) {
            console.warn(`Error fetching sheets for table ${table.id}:`, sheetsError);
            continue;
          }

          for (const sheet of sheets || []) {
            const sheetData = {
              sheet_id: sheet.id,
              sheet_name: sheet.name,
              columns: [] as any[]
            };

            // Get columns for the sheet (exclude automatic columns from being sources)
            const { data: columns, error: columnsError } = await supabase
              .from('columns')
              .select('id, name, data_type, mode')
              .eq('sheet_id', sheet.id)
              .eq('user_id', user_id)
              .eq('is_deleted', false)
              .neq('mode', 'automatic') // Exclude automatic columns to prevent circular dependencies
              .order('name');

            if (columnsError) {
              console.warn(`Error fetching columns for sheet ${sheet.id}:`, columnsError);
              continue;
            }

            for (const column of columns || []) {
              sheetData.columns.push({
                column_id: column.id,
                column_name: column.name,
                data_type: column.data_type,
                mode: column.mode
              });
            }

            tableData.sheets.push(sheetData);
          }

          projectData.tables.push(tableData);
        }

        hierarchicalData.push(projectData);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        data: hierarchicalData,
        format: 'hierarchical',
        total_projects: hierarchicalData.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else {
      // Return flat structure (original behavior)
      const availableColumns: ColumnReference[] = [];

      for (const project of projects || []) {
        const { data: tables, error: tablesError } = await supabase
          .from('better_tables')
          .select('id, name')
          .eq('project_id', project.id)
          .eq('user_id', user_id)
          .eq('is_deleted', false)
          .order('name');

        if (tablesError) {
          console.warn(`Error fetching tables for project ${project.id}:`, tablesError);
          continue;
        }

        for (const table of tables || []) {
          const { data: sheets, error: sheetsError } = await supabase
            .from('better_sheets')
            .select('id, name')
            .eq('table_id', table.id)
            .eq('user_id', user_id)
            .eq('is_deleted', false)
            .order('name');

          if (sheetsError) {
            console.warn(`Error fetching sheets for table ${table.id}:`, sheetsError);
            continue;
          }

          for (const sheet of sheets || []) {
            const { data: columns, error: columnsError } = await supabase
              .from('columns')
              .select('id, name, data_type, mode')
              .eq('sheet_id', sheet.id)
              .eq('user_id', user_id)
              .eq('is_deleted', false)
              .neq('mode', 'automatic')
              .order('name');

            if (columnsError) {
              console.warn(`Error fetching columns for sheet ${sheet.id}:`, columnsError);
              continue;
            }

            for (const column of columns || []) {
              availableColumns.push({
                project_id: project.id,
                project_name: project.name,
                table_id: table.id,
                table_name: table.name,
                sheet_id: sheet.id,
                sheet_name: sheet.name,
                column_id: column.id,
                column_name: column.name,
                data_type: column.data_type,
                mode: column.mode,
                is_current_project: current_project_id === project.id,
                is_current_sheet: current_sheet_id === sheet.id
              });
            }
          }
        }
      }

      // Sort with current project/sheet first
      availableColumns.sort((a, b) => {
        // Current project first
        if (a.is_current_project && !b.is_current_project) return -1;
        if (!a.is_current_project && b.is_current_project) return 1;
        
        // Current sheet second
        if (a.is_current_sheet && !b.is_current_sheet) return -1;
        if (!a.is_current_sheet && b.is_current_sheet) return 1;
        
        // Then by project, table, sheet, column name
        if (a.project_name !== b.project_name) {
          return a.project_name.localeCompare(b.project_name);
        }
        if (a.table_name !== b.table_name) {
          return a.table_name.localeCompare(b.table_name);
        }
        if (a.sheet_name !== b.sheet_name) {
          return a.sheet_name.localeCompare(b.sheet_name);
        }
        return a.column_name.localeCompare(b.column_name);
      });

      return new Response(JSON.stringify({ 
        success: true, 
        data: availableColumns,
        format: 'flat',
        total: availableColumns.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error: any) {
    console.error('Error getting available columns:', error);
    
    return new Response(JSON.stringify({
      error: {
        code: 'FETCH_COLUMNS_ERROR',
        message: error.message
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});