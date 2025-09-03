import { useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase'; // Assuming supabase client is here
import { useAuth } from '@/context/AuthContext'; // Assuming you use auth
import { toast } from 'sonner';
import { Column, SelectOption } from '@/lib/supabase';

/**
 * This hook provides a stable "repository" object with methods for interacting
 * with sheet-related data. Using useMemo ensures that components using this
 * hook won't re-render unnecessarily.
 */
export function useSheetRepo() {
  const { user } = useAuth();

  // Each individual function is wrapped in useCallback
  const createColumn = useCallback(async (columnData: Omit<Column, 'id' | 'user_id' | 'created_at'>): Promise<Column | null> => {
    if (!user) return null;
    try {
      const { data, error } = await supabase.from('columns').insert([{ ...columnData, user_id: user.id }]).select().single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating column:', error);
      toast.error('Failed to create column.');
      return null;
    }
  }, [user]);

  const updateColumn = useCallback(async (columnId: string, updates: Partial<Column>): Promise<boolean> => {
    if (!user) return false;
    try {
      const { error } = await supabase.from('columns').update(updates).eq('id', columnId);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating column:', error);
      toast.error('Failed to update column.');
      return false;
    }
  }, [user]);

  const fetchSelectOptions = useCallback(async (columnId: string): Promise<SelectOption[]> => {
    // ... logic to fetch options
    const { data, error } = await supabase.from('select_options').select('*').eq('column_id', columnId);
    if (error) return [];
    return data || [];
  }, []);

  const createSelectOptions = useCallback(async (columnId: string, options: { value: string, label: string }[]): Promise<boolean> => {
    if (!user) return false;
    // Delete old options first
    await supabase.from('select_options').delete().eq('column_id', columnId);

    // Insert new ones
    const optionData = options.map((opt, index) => ({
        column_id: columnId,
        option_value: opt.value,
        option_label: opt.label,
        option_order: index,
        user_id: user.id
    }));
    const { error } = await supabase.from('select_options').insert(optionData);
    return !error;
  }, [user]);

  // ✨ THE CRITICAL FIX ✨
  // useMemo returns the *same object* on every render, as long as its dependencies
  // (the stable useCallback functions) don't change. This breaks the infinite loop.
  return useMemo(() => ({
    createColumn,
    updateColumn,
    fetchSelectOptions,
    createSelectOptions,
  }), [createColumn, updateColumn, fetchSelectOptions, createSelectOptions]);
}
