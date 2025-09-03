import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

interface AutomatedColumnRule {
  rule_type: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'greater_equal' | 'less_equal'
  condition_value: string
  result_value: string
  rule_order: number
  strict_mode?: boolean
}

interface AutomatedColumnConfig {
  column_id: string
  source_project_id?: string
  source_table_id?: string
  source_sheet_id?: string
  source_column_id?: string
  default_value?: string
  rules: AutomatedColumnRule[]
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
    'Access-Control-Allow-Credentials': 'false'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { config, user_id }: { config: AutomatedColumnConfig, user_id: string } = await req.json();

    if (!config || !user_id) {
      throw new Error('Missing required parameters');
    }

    // First, update the column to automatic mode
    const { error: columnUpdateError } = await supabase
      .from('columns')
      .update({ mode: 'automatic' })
      .eq('id', config.column_id)
      .eq('user_id', user_id);

    if (columnUpdateError) {
      throw columnUpdateError;
    }

    // Create the automated column configuration
    const { data: automatedConfig, error: configError } = await supabase
      .from('automated_column_configurations')
      .insert([{
        column_id: config.column_id,
        source_project_id: config.source_project_id,
        source_table_id: config.source_table_id,
        source_sheet_id: config.source_sheet_id,
        source_column_id: config.source_column_id,
        default_value: config.default_value,
        user_id: user_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (configError) {
      throw configError;
    }

    // Create the automated column rules with strict mode support
    if (config.rules && config.rules.length > 0) {
      const rulesData = config.rules.map(rule => ({
        automated_config_id: automatedConfig.id,
        rule_type: rule.rule_type,
        condition_value: rule.condition_value,
        result_value: rule.result_value,
        rule_order: rule.rule_order,
        strict_mode: rule.strict_mode || false, // Default to false for backward compatibility
        user_id: user_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error: rulesError } = await supabase
        .from('automated_column_rules')
        .insert(rulesData);

      if (rulesError) {
        // If rules creation fails, cleanup the config and column mode
        await supabase
          .from('automated_column_configurations')
          .delete()
          .eq('id', automatedConfig.id);
        await supabase
          .from('columns')
          .update({ mode: 'manual' })
          .eq('id', config.column_id);
        throw rulesError;
      }
    }

    // Log the column edit history
    await supabase
      .from('column_edit_history')
      .insert([{
        column_id: config.column_id,
        old_config: { mode: 'manual' },
        new_config: { mode: 'automatic', automation_config: config },
        change_type: 'mode_change',
        edited_by: user_id,
        notes: 'Column converted to automatic mode'
      }]);

    // Trigger evaluation for all existing rows in the sheet
    const { data: column, error: columnError } = await supabase
      .from('columns')
      .select('sheet_id')
      .eq('id', config.column_id)
      .single();

    if (columnError) {
      console.warn('Could not get sheet_id for automated evaluation:', columnError);
    } else {
      // Call the evaluation function for the entire sheet
      try {
        await supabase.functions.invoke('evaluate-automated-columns', {
          body: {
            sheet_id: column.sheet_id,
            user_id: user_id
          }
        });
      } catch (evalError) {
        console.warn('Could not trigger automated evaluation:', evalError);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      data: automatedConfig,
      message: 'Automated column configuration created successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error creating automated column config:', error);
    
    return new Response(JSON.stringify({
      error: {
        code: 'CONFIG_CREATION_ERROR',
        message: error.message
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});