import { useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { nanoid } from 'nanoid';
import { BetterSheet } from '@/lib/supabase';

/**
 * A stateless utility hook that provides functions for interacting with sheets.
 * It does not manage its own state.
 */
export function useSheets() {
  const { user } = useAuth();

  /**
   * Fetches and returns all sheets for a given tableId.
   */
  const fetchSheets = useCallback(async (tableId: string): Promise<BetterSheet[]> => {
    if (!user || !tableId) return [];

    try {
      const { data, error } = await supabase
        .from('better_sheets')
        .select('*')
        .eq('table_id', tableId)
        .eq('is_deleted', false)
        .order('position', { ascending: true });

      if (error) throw error;
      
      return data || []; // <-- Return the data

    } catch (err: any) {
      console.error('Error fetching sheets:', err);
      toast.error('Failed to fetch sheets');
      return []; // Return empty array on error
    }
  }, [user]);

  /**
   * Creates a new sheet for a given table.
   */
  const createSheet = useCallback(async (sheetData: {
    tableId: string;
    name: string;
    description?: string;
  }): Promise<BetterSheet | null> => {
    if (!user || !sheetData.tableId) return null;

    let finalName = sheetData.name;
    if (sheetData.name === 'New Sheet' || sheetData.name.includes('New Sheet (')) {
      finalName = `New Sheet ${nanoid(6)}`;
    }

    try {
      const { data, error } = await supabase
        .from('better_sheets')
        .insert([{
          name: finalName,
          description: sheetData.description,
          table_id: sheetData.tableId,
          user_id: user.id
        }])
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Sheet created successfully');
      return data;

    } catch (error: any) {
      console.error('Error creating sheet:', error);
      toast.error('Failed to create sheet');
      return null;
    }
  }, [user]);

  /**
   * Updates an existing sheet.
   */
  const updateSheet = useCallback(async (sheetId: string, updates: Partial<BetterSheet>): Promise<boolean> => {
    if (!user) return false;

    try {
        const { error } = await supabase
        .from('better_sheets')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', sheetId);

        if (error) throw error;
        
        toast.success('Sheet updated successfully');
        return true;
    } catch (error: any) {
        console.error('Error updating sheet:', error);
        toast.error('Failed to update sheet');
        return false;
    }
  }, [user]);

  /**
   * Deletes a sheet and its related columns and rows.
   */
  const deleteSheet = useCallback(async (sheetId: string, showToast: boolean = true): Promise<boolean> => {
    if (!user) return false;

    try {
      // Hard-delete the dependent columns and rows first
      await supabase.from('columns').delete().eq('sheet_id', sheetId);
      await supabase.from('rows').delete().eq('sheet_id', sheetId);

      // Soft-delete the sheet itself
      const { error: sheetError } = await supabase
        .from('better_sheets')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', sheetId);

      if (sheetError) throw new Error('Failed to delete sheet');

      if (showToast) toast.success('Sheet deleted successfully');
      
      return true;
    } catch (error: any) {
      console.error('Error deleting sheet:', error);
      if (showToast) toast.error(error.message || 'Failed to delete sheet');
      return false;
    }
  }, [user]);

  // Memoize the returned functions for performance.
  return useMemo(() => ({
    fetchSheets,
    createSheet,
    updateSheet,
    deleteSheet,
  }), [fetchSheets, createSheet, updateSheet, deleteSheet]);
}