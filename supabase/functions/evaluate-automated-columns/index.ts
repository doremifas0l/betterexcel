import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// =================================================================
// FIX #2: Define CORS headers once to be used in all responses.
// =================================================================
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Database type definitions for type safety
interface Database {
  public: {
    Tables: {
      columns: {
        Row: { id: string, sheet_id: string, mode: string }
      },
      rows: {
        Row: { id: string, sheet_id: string, row_data: any },
        Update: { row_data: any }
      },
      automated_column_configurations: {
        Row: {
          column_id: string,
          source_sheet_id: string,
          source_column_id: string,
          default_value: string | null,
          automated_column_rules: {
            rule_type: string,
            condition_value: string,
            result_value: string,
            rule_order: number,
            strict_mode: boolean
          }[]
        }
      },
      automated_column_rules: {
        Row: {
          id: string,
          rule_type: string,
          condition_value: string,
          result_value: string,
          rule_order: number,
          strict_mode: boolean,
          configuration_id: string
        }
      }
    }
  }
}

Deno.serve(async (req) => {
  // Handle the preflight OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize the Supabase client with the service role key for admin privileges
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Get the sheet_id and optional row_id from the request body
    const body = await req.json();
    const { sheet_id, row_id } = body;

    if (!sheet_id) {
      throw new Error('Missing required parameter: sheet_id');
    }

    // 1. Find all columns on the sheet that are in "automatic" mode
    const { data: automaticColumns, error: columnsError } = await supabase
      .from('columns')
      .select('id')
      .eq('sheet_id', sheet_id)
      .eq('mode', 'automatic');

    if (columnsError) throw columnsError;

    // If there are no automatic columns, there's nothing to do
    if (!automaticColumns || automaticColumns.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No automatic columns found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const columnIds = automaticColumns.map(c => c.id);

    // 2. Fetch the configuration and rules for all those automatic columns
    const { data: configs, error: configsError } = await supabase
      .from('automated_column_configurations')
      .select(`
        column_id, source_sheet_id, source_column_id, default_value,
        automated_column_rules ( rule_type, condition_value, result_value, rule_order, strict_mode )
      `)
      .in('column_id', columnIds);

    if (configsError) throw configsError;

    // Create a Map for quick lookup of a column's configuration
    const configMap = new Map(configs.map(c => [c.column_id, c]));

    // 3. Fetch the rows that need to be updated
    let rowsToUpdate: { id: string; row_data: any }[] = [];
    if (row_id) { // If a specific row is passed, update only that one
      const { data: singleRow, error: rowError } = await supabase.from('rows').select('id, row_data').eq('id', row_id).single();
      if (rowError) throw rowError;
      if (singleRow) rowsToUpdate.push(singleRow);
    } else { // Otherwise, update all rows in the sheet
      const { data: allRows, error: rowsError } = await supabase.from('rows').select('id, row_data').eq('sheet_id', sheet_id);
      if (rowsError) throw rowsError;
      rowsToUpdate = allRows || [];
    }

    const updatePromises: Promise<any>[] = [];

    // =================================================================
    // FIX #3: This is the fully corrected logic loop.
    // =================================================================
    for (const row of rowsToUpdate) {
      const updatedRowData = { ...row.row_data };
      let hasChanges = false;

      // Loop through every automatic column that exists on this sheet.
      for (const columnId of columnIds) {
        const config = configMap.get(columnId);
        if (!config || !config.source_column_id) continue;

        // STEP 1: Determine the correct final value.
        // Start by assuming the configured default value (or null).
        let finalValue = config.default_value ?? null;
        const sourceValue = row.row_data?.[config.source_column_id] ?? null;

        // Evaluate the rules to see if one matches.
        if (config.source_sheet_id === sheet_id) {
          const rules = (config.automated_column_rules || []).sort((a, b) => a.rule_order - b.rule_order);
          for (const rule of rules) {
            if (evaluateRule(sourceValue, rule.rule_type, rule.condition_value, rule.strict_mode)) {
              // If a rule matches, its result becomes the final value.
              finalValue = rule.result_value;
              break; // Stop checking rules for this column.
            }
          }
        } else {
            finalValue = "Cross-sheet automation not yet supported.";
        }
        
        // STEP 2: Assert the new value.
        // If the calculated final value is different from the current value in the row,
        // then we have a change that needs to be saved.
        if (updatedRowData[columnId] !== finalValue) {
            updatedRowData[columnId] = finalValue;
            hasChanges = true;
        }
      }

      // STEP 3: If any changes were made, add the update operation to our list.
      if (hasChanges) {
        updatePromises.push(supabase.from('rows').update({ row_data: updatedRowData }).eq('id', row.id));
      }
    }

    // 4. Execute all database updates concurrently
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }

    // 5. Send a success response with CORS headers
    return new Response(JSON.stringify({ success: true, updated_rows: updatePromises.length }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('CRITICAL ERROR in evaluate-automated-columns:', error);
    // On any error, send a 500 status response with CORS headers
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});


// =================================================================
// FIX #1: The fully corrected helper function.
// =================================================================
function evaluateRule(sourceValue: any, ruleType: string, conditionValueStr: string, strictMode: boolean): boolean {
  // Check if the rule is numeric.
  const isNumericRule = ['greater_than', 'less_than', 'greater_equal', 'less_equal'].includes(ruleType);

  // If the source is empty AND it's a numeric rule, treat the source as 0.
  if ((sourceValue === null || sourceValue === undefined || sourceValue === '') && isNumericRule) {
    sourceValue = 0;
  }
  
  // If the source is still empty (for non-numeric rules), handle equality or exit.
  if (sourceValue === null || sourceValue === undefined) {
    if (ruleType === 'equals') {
      return conditionValueStr === 'null' || conditionValueStr === '';
    }
    return false;
  }

  // The rest of the function correctly parses and compares values.
  let conditionValue: any;
  const sourceType = typeof sourceValue;

  if (sourceType === 'number') {
    conditionValue = parseFloat(conditionValueStr);
  } else if (sourceType === 'boolean') {
    conditionValue = conditionValueStr.toLowerCase() === 'true';
  } else {
    conditionValue = conditionValueStr;
  }

  let sourceForStringCompare = String(sourceValue);
  let conditionForStringCompare = String(conditionValue);

  if (!strictMode && sourceType === 'string') {
    sourceForStringCompare = sourceForStringCompare.toLowerCase();
    conditionForStringCompare = conditionForStringCompare.toLowerCase();
  }

  switch (ruleType) {
    case 'equals':
      if (sourceType === 'string' || sourceType === 'boolean') {
        return sourceForStringCompare === conditionForStringCompare;
      }
      return sourceValue === conditionValue;
    case 'contains':
      if (sourceType !== 'string') return false;
      return sourceForStringCompare.includes(conditionForStringCompare);
    case 'greater_than':
      if (typeof sourceValue !== 'number' || isNaN(conditionValue)) return false;
      return sourceValue > conditionValue;
    case 'less_than':
      if (typeof sourceValue !== 'number' || isNaN(conditionValue)) return false;
      return sourceValue < conditionValue;
    case 'greater_equal':
      if (typeof sourceValue !== 'number' || isNaN(conditionValue)) return false;
      return sourceValue >= conditionValue;
    case 'less_equal':
      if (typeof sourceValue !== 'number' || isNaN(conditionValue)) return false;
      return sourceValue <= conditionValue;
    default:
      return false;
  }
}