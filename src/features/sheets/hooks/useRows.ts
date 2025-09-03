import { useCallback, useMemo } from 'react';
import { supabase, Row } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export function useRows() {
  const { user } = useAuth();

  const fetchRows = useCallback(async (sheetId: string): Promise<Row[]> => {
    if (!user || !sheetId) return [];
    try {
      const { data, error } = await supabase
        .from('rows')
        .select('*')
        .eq('sheet_id', sheetId)
        .eq('is_deleted', false)
        .order('row_order', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (err: any) {
      toast.error('Failed to fetch rows.');
      console.error("Error fetching rows:", err);
      return [];
    }
  }, [user]);

  const createRow = useCallback(async (
    sheetId: string, 
    rowData: any, 
    rowOrder: number
  ): Promise<Row | null> => {
    if (!user || !sheetId) {
        toast.error("Cannot create row: User or Sheet ID is missing.");
        return null;
    };
    try {
        const { data, error } = await supabase
        .from('rows')
        .insert({
          sheet_id: sheetId,
          row_data: rowData,
          user_id: user.id,
          row_order: rowOrder,
        })
        .select()
        .single();
      if (error) throw error;
      if (!data) throw new Error("Row creation did not return data.");
      return data;
    } catch(error: any) {
        toast.error("Failed to create row.");
        console.error("Error creating row:", error);
        return null;
    }
  }, [user]);

  const updateRow = useCallback(async (rowId: string, rowData: any): Promise<boolean> => {
    if (!user) {
        toast.error("Authentication error.");
        return false;
    }

    // ✨ NEW DEBUGGING STEP: Log the exact data being sent.
    console.log(`--- Attempting to update row ---`);
    console.log(`Row ID:`, rowId);
    console.log(`Payload being sent:`, JSON.stringify(rowData, null, 2));

    try {
        // ✨ THE FIX: The .eq() filter must come before the .select().
        const { data, error, status } = await supabase
        .from('rows')
        .update({
          row_data: rowData,
          updated_at: new Date().toISOString()
        })
        .eq('id', rowId) // 1. Filter to specify WHICH row to update.
        .select();      // 2. Select to get the updated data back.
      
      // ✨ ENHANCED DEBUGGING: Log the full response from Supabase.
      console.log(`--- Supabase response received ---`);
      console.log(`Status Code:`, status);
      console.log(`Response Data:`, data);
      console.log(`Response Error:`, error);
      
      if (error) {
        console.error("Supabase update error object:", error);
        throw error;
      }
      
      // A silent RLS failure often results in an empty data array and no error.
      if (!data || (Array.isArray(data) && data.length === 0)) {
          console.warn("Supabase update returned no data. This is a strong indicator that a Row Level Security (RLS) policy is silently blocking the update.");
      }

      return true;

    } catch(error: any) {
        toast.error("Failed to update row.");
        console.error("Error in updateRow catch block:", error);
        return false;
    }
  }, [user]);

  const deleteRows = useCallback(async (rowIds: string[]): Promise<boolean> => {
    if (!user || rowIds.length === 0) {
        toast.error("Cannot delete: No rows selected or user not authenticated.");
        return false;
    }
    try {
        const { error } = await supabase
        .from('rows')
        .delete()
        .in('id', rowIds);
      if (error) throw error;
      toast.success("Row(s) deleted successfully.");
      return true;
    } catch(error: any) {
        toast.error("Failed to delete rows.");
        console.error("Error deleting rows:", error);
        return false;
    }
  }, [user]);

  // This is correct, no changes needed here.
  return useMemo(() => ({
    fetchRows,
    createRow,
    updateRow,
    deleteRows,
  }), [fetchRows, createRow, updateRow, deleteRows]);
}

