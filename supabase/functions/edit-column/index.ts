import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

interface ColumnUpdateRequest {
  column_id: string
  updates: {
    name?: string
    data_type?: string
    mode?: 'manual' | 'automatic'
    is_required?: boolean
    is_unique?: boolean
    default_value?: string
    validation_rules?: any
    config?: any
  }
  conversion_strategy?: 'keep_data' | 'clear_data' | 'convert_data'
  user_id: string
}

interface ConversionPreview {
  total_rows: number
  success_count: number
  failure_count: number
  sample_conversions: Array<{
    original_value: any
    converted_value: any
    success: boolean
    error?: string
  }>
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

    const requestData: ColumnUpdateRequest = await req.json();
    const { column_id, updates, conversion_strategy = 'keep_data', user_id } = requestData;

    if (!column_id || !user_id) {
      throw new Error('Missing required parameters: column_id, user_id');
    }

    // Get current column data
    const { data: currentColumn, error: columnError } = await supabase
      .from('columns')
      .select('*')
      .eq('id', column_id)
      .eq('user_id', user_id)
      .single();

    if (columnError || !currentColumn) {
      throw new Error('Column not found or access denied');
    }

    let conversionPreview: ConversionPreview | null = null;

    // If changing data type, handle data conversion
    if (updates.data_type && updates.data_type !== currentColumn.data_type) {
      // Get all rows that have data for this column
      const { data: rows, error: rowsError } = await supabase
        .from('rows')
        .select('id, row_data')
        .eq('sheet_id', currentColumn.sheet_id)
        .eq('user_id', user_id)
        .eq('is_deleted', false);

      if (rowsError) {
        throw rowsError;
      }

      // Generate conversion preview
      conversionPreview = await generateConversionPreview(
        rows || [],
        column_id,
        currentColumn.data_type,
        updates.data_type
      );

      // Store conversion tracking
      await supabase
        .from('column_conversions')
        .insert([{
          column_id: column_id,
          from_type: currentColumn.data_type,
          to_type: updates.data_type,
          success_count: conversionPreview.success_count,
          failure_count: conversionPreview.failure_count,
          conversion_errors: conversionPreview.sample_conversions
            .filter(c => !c.success)
            .map(c => ({ original: c.original_value, error: c.error })),
          preview_data: conversionPreview.sample_conversions.slice(0, 10), // Store first 10 for preview
          user_id: user_id
        }]);

      // Apply data conversion based on strategy
      if (conversion_strategy === 'convert_data' && rows) {
        await applyDataConversion(
          supabase,
          rows,
          column_id,
          currentColumn.data_type,
          updates.data_type,
          user_id
        );
      } else if (conversion_strategy === 'clear_data' && rows) {
        await clearColumnData(supabase, rows, column_id, user_id);
      }
    }

    // Update the column
    const { data: updatedColumn, error: updateError } = await supabase
      .from('columns')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', column_id)
      .eq('user_id', user_id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Log the change in history
    await supabase
      .from('column_edit_history')
      .insert([{
        column_id: column_id,
        old_config: {
          name: currentColumn.name,
          data_type: currentColumn.data_type,
          mode: currentColumn.mode,
          is_required: currentColumn.is_required,
          is_unique: currentColumn.is_unique,
          default_value: currentColumn.default_value,
          validation_rules: currentColumn.validation_rules
        },
        new_config: {
          name: updates.name || currentColumn.name,
          data_type: updates.data_type || currentColumn.data_type,
          mode: updates.mode || currentColumn.mode,
          is_required: updates.is_required ?? currentColumn.is_required,
          is_unique: updates.is_unique ?? currentColumn.is_unique,
          default_value: updates.default_value ?? currentColumn.default_value,
          validation_rules: updates.validation_rules || currentColumn.validation_rules
        },
        change_type: determineChangeType(currentColumn, updates),
        edited_by: user_id,
        notes: `Column updated: ${Object.keys(updates).join(', ')}`
      }]);

    // If mode changed to automatic, trigger evaluation
    if (updates.mode === 'automatic' && currentColumn.mode !== 'automatic') {
      try {
        await supabase.functions.invoke('evaluate-automated-columns', {
          body: {
            sheet_id: currentColumn.sheet_id,
            user_id: user_id
          }
        });
      } catch (evalError) {
        console.warn('Could not trigger automated evaluation:', evalError);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      data: updatedColumn,
      conversion_preview: conversionPreview,
      message: 'Column updated successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error updating column:', error);
    
    return new Response(JSON.stringify({
      error: {
        code: 'COLUMN_UPDATE_ERROR',
        message: error.message
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Generate conversion preview
async function generateConversionPreview(
  rows: any[],
  columnId: string,
  fromType: string,
  toType: string
): Promise<ConversionPreview> {
  const preview: ConversionPreview = {
    total_rows: 0,
    success_count: 0,
    failure_count: 0,
    sample_conversions: []
  };

  const rowsWithData = rows.filter(row => row.row_data?.[columnId] != null);
  preview.total_rows = rowsWithData.length;

  // Sample up to 50 rows for preview
  const sampleRows = rowsWithData.slice(0, 50);

  for (const row of sampleRows) {
    const originalValue = row.row_data[columnId];
    const conversionResult = convertValue(originalValue, fromType, toType);
    
    preview.sample_conversions.push({
      original_value: originalValue,
      converted_value: conversionResult.value,
      success: conversionResult.success,
      error: conversionResult.error
    });

    if (conversionResult.success) {
      preview.success_count++;
    } else {
      preview.failure_count++;
    }
  }

  // Estimate total success/failure counts based on sample
  if (sampleRows.length > 0 && preview.total_rows > sampleRows.length) {
    const successRate = preview.success_count / sampleRows.length;
    preview.success_count = Math.round(preview.total_rows * successRate);
    preview.failure_count = preview.total_rows - preview.success_count;
  }

  return preview;
}

// Convert individual values between types
function convertValue(value: any, fromType: string, toType: string): { value: any, success: boolean, error?: string } {
  try {
    if (value == null || value === '') {
      return { value: null, success: true };
    }

    switch (toType) {
      case 'text':
      case 'textarea':
        return { value: String(value), success: true };
      
      case 'number':
        const numValue = Number(value);
        if (isNaN(numValue)) {
          return { value: null, success: false, error: `Cannot convert '${value}' to number` };
        }
        return { value: numValue, success: true };
      
      case 'checkbox':
        if (typeof value === 'boolean') {
          return { value, success: true };
        }
        const strValue = String(value).toLowerCase();
        const boolValue = ['true', '1', 'yes', 'on'].includes(strValue);
        return { value: boolValue, success: true };
      
      case 'date':
      case 'datetime':
        const dateValue = new Date(value);
        if (isNaN(dateValue.getTime())) {
          return { value: null, success: false, error: `Cannot convert '${value}' to date` };
        }
        return { value: dateValue.toISOString(), success: true };
      
      case 'email':
        const emailStr = String(value);
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailStr)) {
          return { value: emailStr, success: false, error: `'${value}' is not a valid email` };
        }
        return { value: emailStr, success: true };
      
      default:
        return { value: String(value), success: true };
    }
  } catch (error) {
    return { value: null, success: false, error: String(error) };
  }
}

// Apply data conversion to all rows
async function applyDataConversion(
  supabase: any,
  rows: any[],
  columnId: string,
  fromType: string,
  toType: string,
  userId: string
): Promise<void> {
  for (const row of rows) {
    if (row.row_data?.[columnId] != null) {
      const originalValue = row.row_data[columnId];
      const conversionResult = convertValue(originalValue, fromType, toType);
      
      if (conversionResult.success) {
        const updatedRowData = {
          ...row.row_data,
          [columnId]: conversionResult.value
        };
        
        await supabase
          .from('rows')
          .update({
            row_data: updatedRowData,
            updated_at: new Date().toISOString()
          })
          .eq('id', row.id)
          .eq('user_id', userId);
      }
    }
  }
}

// Clear column data for all rows
async function clearColumnData(
  supabase: any,
  rows: any[],
  columnId: string,
  userId: string
): Promise<void> {
  for (const row of rows) {
    if (row.row_data?.[columnId] != null) {
      const updatedRowData = { ...row.row_data };
      delete updatedRowData[columnId];
      
      await supabase
        .from('rows')
        .update({
          row_data: updatedRowData,
          updated_at: new Date().toISOString()
        })
        .eq('id', row.id)
        .eq('user_id', userId);
    }
  }
}

// Determine the type of change for logging
function determineChangeType(currentColumn: any, updates: any): string {
  const changes = [];
  
  if (updates.name && updates.name !== currentColumn.name) changes.push('name');
  if (updates.data_type && updates.data_type !== currentColumn.data_type) changes.push('type');
  if (updates.mode && updates.mode !== currentColumn.mode) changes.push('mode');
  if (updates.is_required !== undefined && updates.is_required !== currentColumn.is_required) changes.push('required');
  if (updates.is_unique !== undefined && updates.is_unique !== currentColumn.is_unique) changes.push('unique');
  if (updates.default_value !== undefined && updates.default_value !== currentColumn.default_value) changes.push('default');
  if (updates.validation_rules && JSON.stringify(updates.validation_rules) !== JSON.stringify(currentColumn.validation_rules)) changes.push('validation');
  
  return changes.length > 0 ? `${changes.join('_')}_change` : 'general_update';
}