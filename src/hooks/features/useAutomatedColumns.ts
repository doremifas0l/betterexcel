import { useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// --- FINAL UPDATE: Import types from the central Supabase file ---
import { 
  AvailableColumn, 
  AutomatedColumnConfig, 
  UpdateAutomatedColumnConfigPayload 
} from '@/lib/supabase';

/**
 * Provides all functions for managing the "Automated Column" feature.
 */
export function useAutomatedColumns() {
  const { user } = useAuth();

  const getAutomatedColumnConfig = useCallback(async (columnId: string): Promise<AutomatedColumnConfig | null> => {
    if (!user) return null;
    try {
        const { data: config, error: configError } = await supabase.from('automated_column_configurations').select('*').eq('column_id', columnId).maybeSingle();
        if (configError) throw configError;
        if (!config) return null;

        const { data: rules, error: rulesError } = await supabase.from('automated_column_rules').select('*').eq('automated_config_id', config.id).order('rule_order');
        if (rulesError) throw rulesError;
        
        return { ...config, rules: rules || [] };
    } catch (error) {
        console.error('Error getting automated column config:', error);
        return null;
    }
  }, [user]);

  const updateAutomatedColumnConfig = useCallback(async (columnId: string, config: UpdateAutomatedColumnConfigPayload): Promise<boolean> => {
    if (!user) return false;
    try {
      let { data: existingConfig } = await supabase.from('automated_column_configurations').select('id').eq('column_id', columnId).single();
      let configId = existingConfig?.id;
      
      const configPayload = {
          source_column_id: config.source_column_id,
          default_value: config.default_value,
      };

      if (!configId) {
        const { data: newConfig, error } = await supabase.from('automated_column_configurations').insert({ column_id: columnId, ...configPayload, user_id: user.id }).select('id').single();
        if (error) throw error;
        configId = newConfig.id;
      } else {
        const { error } = await supabase.from('automated_column_configurations').update(configPayload).eq('id', configId);
        if (error) throw error;
      }

      await supabase.from('automated_column_rules').delete().eq('automated_config_id', configId);

      if (config.rules && config.rules.length > 0) {
        const rulesToInsert = config.rules.map(rule => ({ ...rule, automated_config_id: configId, user_id: user.id }));
        const { error: rulesError } = await supabase.from('automated_column_rules').insert(rulesToInsert);
        if (rulesError) throw rulesError;
      }
      
      toast.success('Automation rules updated!');
      return true;
    } catch (error: any) {
      console.error('Error updating automated column config:', error);
      toast.error('Failed to update automation rules');
      return false;
    }
  }, [user]);

  const getAvailableColumns = useCallback(async (): Promise<AvailableColumn[]> => {
    if (!user) return [];
    try {
        const { data, error } = await supabase.rpc('get_available_columns');
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching available columns:', error);
        return [];
    }
  }, [user]);

  const getColumnSampleData = useCallback(async (columnId: string, limit: number = 10): Promise<any[]> => {
     if (!user) return [];
    try {
        const { data } = await supabase.rpc('get_column_sample_data', { col_id: columnId, row_limit: limit });
        return data || [];
    } catch (error) {
        console.error('Error getting column sample data:', error);
        return [];
    }
  }, [user]);

  const triggerAutomatedColumnEvaluation = useCallback(async (sheetId: string, rowId?: string): Promise<boolean> => {
    if (!user) return false;
    try {
        await supabase.rpc('evaluate_automated_columns', { p_sheet_id: sheetId, p_row_id: rowId });
        return true;
    } catch (error) {
        console.error('Error evaluating automated columns:', error);
        return false;
    }
  }, [user]);

  const createComputedConfiguration = useCallback(async (computedConfig: {
    column_id: string;
    formula: string;
  }): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase.from('computed_configurations').insert([{ ...computedConfig, user_id: user.id }]);
    if (error) {
      console.error('Error creating computed configuration:', error);
      toast.error('Failed to save formula');
      return false;
    }
    return true;
  }, [user]);
  
  return useMemo(() => ({
    getAutomatedColumnConfig,
    updateAutomatedColumnConfig,
    getAvailableColumns,
    getColumnSampleData,
    triggerAutomatedColumnEvaluation,
    createComputedConfiguration,
  }), [
      getAutomatedColumnConfig,
      updateAutomatedColumnConfig,
      getAvailableColumns,
      getColumnSampleData,
      triggerAutomatedColumnEvaluation,
      createComputedConfiguration,
  ]);
}