import { useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Column, SelectOption } from '@/lib/supabase';
import { useRollups } from '@/hooks/features/useRollups';

/**
 * A stateless utility hook that provides functions for interacting with columns.
 * It does not manage its own state.
 */
export function useColumns() {
  const { user } = useAuth();
  const { validateRollupConfiguration, createRollupConfiguration } = useRollups();

  /**
   * Fetches and returns all columns for a given sheetId.
   */
  const fetchColumns = useCallback(async (sheetId: string): Promise<Column[]> => {
    if (!user || !sheetId) return [];

    try {
      const { data, error } = await supabase
        .from('columns')
        .select('*')
        .eq('sheet_id', sheetId)
        .eq('is_deleted', false)
        .order('position', { ascending: true });

      if (error) throw error;
      
      const mappedData = (data || []).map(col => ({
        ...col,
        data_type: col.type || col.data_type || 'text',
        is_required: col.required !== undefined ? col.required : col.is_required || false,
        validation_rules: col.config?.min ? { min: col.config.min, max: col.config.max } : (col.validation_rules || {})
      }));

      return mappedData; // <-- Return the data

    } catch (err: any) {
      console.error('Error fetching columns:', err);
      toast.error('Failed to fetch columns');
      return []; // Return empty array on error
    }
  }, [user]);

  /**
   * Creates a new column for a given sheet.
   */
  const createColumn = useCallback(async (columnData: {
    sheet_id: string;
    name: string;
    data_type: string;
    is_required?: boolean;
    is_unique?: boolean;
    default_value?: string;
    validation_rules?: any;
    config?: any;
  }): Promise<Column | null> => {
    if (!user) return null;

    const { data: existingColumns } = await supabase.from('columns').select('name').eq('sheet_id', columnData.sheet_id);
    if (existingColumns?.some(c => c.name.toLowerCase() === columnData.name.toLowerCase())) {
      toast.error(`Column "${columnData.name}" already exists`);
      return null;
    }

    if (columnData.data_type === 'rollup' && columnData.config?.rollup) {
      const validation = await validateRollupConfiguration(columnData.config.rollup);
      if (!validation.is_valid) {
        toast.error(`Rollup validation failed: ${validation.error_message}`);
        return null;
      }
    }

    try {
      const { data, error } = await supabase.from('columns').insert([{ ...columnData, user_id: user.id }]).select().single();
      if (error) throw error;

      if (columnData.data_type === 'rollup' && columnData.config?.rollup && data) {
        await createRollupConfiguration({ column_id: data.id, ...columnData.config.rollup });
      }
      
      toast.success('Column created successfully!');
      return data;

    } catch (error: any) {
      console.error('Error creating column:', error);
      toast.error('Failed to create column.');
      return null;
    }
  }, [user, validateRollupConfiguration, createRollupConfiguration]);

  /**
   * Updates an existing column.
   */
  const updateColumn = useCallback(async (columnId: string, updates: Partial<Column>): Promise<boolean> => {
    if (!user) return false;
    try {
      const { error } = await supabase
        .from('columns')
        .update({
          ...updates,
          type: updates.data_type,
          required: updates.is_required,
          updated_at: new Date().toISOString()
        })
        .eq('id', columnId);
      
      if (error) throw error;
      
      toast.success('Column updated successfully!');
      return true;
    } catch (error: any) {
      console.error('Error updating column:', error);
      if (error.code === '23505') {
        toast.error('A column with this name already exists in this sheet.');
      } else {
        toast.error('Failed to update column.');
      }
      return false;
    }
  }, [user]);

  /**
   * Fetches the options for a 'select' type column.
   */
  const fetchSelectOptions = useCallback(async (columnId: string): Promise<SelectOption[]> => {
    if (!user) return [];
    
    const { data, error } = await supabase
      .from('select_options')
      .select('*')
      .eq('column_id', columnId)
      .order('option_order', { ascending: true });
    
    if (error) {
      console.error('Error fetching select options:', error);
      return [];
    }
    
    return data || [];
  }, [user]);

  /**
   * Creates (or overwrites) the set of options for a 'select' type column.
   */
  const createSelectOptions = useCallback(async (columnId: string, options: { value: string; label: string }[]): Promise<boolean> => {
    if (!user) return false;
    
    const optionData = options.map((option, index) => ({
      column_id: columnId,
      option_value: option.value,
      option_label: option.label,
      option_order: index,
      user_id: user.id
    }));
    
    await supabase.from('select_options').delete().eq('column_id', columnId);
    const { error } = await supabase.from('select_options').insert(optionData);
    
    if (error) {
      console.error('Error creating select options:', error);
      toast.error('Failed to save select options');
      return false;
    }
    
    return true;
  }, [user]);


  const getColumnSampleData = useCallback(async (columnId: string, limit: number = 5): Promise<any[]> => {
    if (!user) return [];
    try {
      const { data, error } = await supabase.rpc('get_column_sample_data', {
        col_id: columnId,
        row_limit: limit
      });

      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Error fetching column sample data:", err);
      // This is for a preview, so no toast is necessary on failure
      return [];
    }
  }, [user]);

  return useMemo(() => ({
    fetchColumns,
    createColumn,
    updateColumn,
    fetchSelectOptions,
    createSelectOptions,
    getColumnSampleData, // <-- Expose the new function
  }), [
    fetchColumns,
    createColumn,
    updateColumn,
    fetchSelectOptions,
    createSelectOptions,
    getColumnSampleData, // <-- Add to dependency array
  ]);
}