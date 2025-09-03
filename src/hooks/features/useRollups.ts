import { useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { RollupConfiguration, Column } from '@/lib/supabase';

// Define the shape of the configuration object used for validation and creation
interface RollupConfigData {
  source_link_column_id: string;
  source_field_column_id: string;
  aggregation_function: string;
}

export function useRollups() {
  const { user } = useAuth();

  /**
   * Validates a potential rollup configuration before creation.
   * Checks if the linked column and target field are compatible with the aggregation function.
   */
  const validateRollupConfiguration = useCallback(async (
    rollupConfig: RollupConfigData
  ): Promise<{ is_valid: boolean; error_message: string }> => {
    try {
      if (!rollupConfig.source_link_column_id || !rollupConfig.source_field_column_id || !rollupConfig.aggregation_function) {
        return { is_valid: false, error_message: 'All rollup configuration fields are required.' };
      }

      // 1. Fetch the target field to check its data type
      const { data: targetField, error: fieldError } = await supabase
        .from('columns')
        .select('data_type')
        .eq('id', rollupConfig.source_field_column_id)
        .single();
      
      if (fieldError || !targetField) {
        return { is_valid: false, error_message: 'Could not find the target field to aggregate.' };
      }

      const numericFunctions = ['sum', 'average'];
      // 2. Check for compatibility
      if (numericFunctions.includes(rollupConfig.aggregation_function) && targetField.data_type !== 'number') {
        return { is_valid: false, error_message: `Cannot use "${rollupConfig.aggregation_function}" on a non-numeric field.` };
      }

      return { is_valid: true, error_message: '' };
    } catch (error) {
      console.error("Rollup validation error:", error);
      return { is_valid: false, error_message: 'An unexpected error occurred during validation.' };
    }
  }, []);

  /**
   * Creates a new rollup configuration record in the database.
   */
  const createRollupConfiguration = useCallback(async (
    rollupData: RollupConfigData & { column_id: string }
  ): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const { error } = await supabase
        .from('rollup_configurations')
        .insert([{
          column_id: rollupData.column_id,
          source_link_column_id: rollupData.source_link_column_id,
          source_field_column_id: rollupData.source_field_column_id,
          aggregation_function: rollupData.aggregation_function,
          user_id: user.id
        }]);

      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('Error creating rollup configuration:', error);
      toast.error('Failed to save rollup configuration.');
      return false;
    }
  }, [user]);

  /**
   * Fetches the full configuration for a given rollup column.
   */
  const fetchRollupConfiguration = useCallback(async (columnId: string): Promise<RollupConfiguration | null> => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('rollup_configurations')
        .select('*')
        .eq('column_id', columnId)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      // It's common for a config not to be found, so no toast here
      console.error('Error fetching rollup config:', error);
      return null;
    }
  }, [user]);

  return {
    createRollupConfiguration,
    fetchRollupConfiguration,
    validateRollupConfiguration,
  };
}
