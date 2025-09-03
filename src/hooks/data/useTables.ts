import { useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, BetterTable } from '@/lib/supabase';
import { toast } from 'sonner';
import { nanoid } from 'nanoid';
import { deleteSheetAndContents } from '@/services/dbSheetService';

/**
 * A stateless utility hook that provides functions for interacting with tables.
 * It does not manage its own state.
 */
export function useTables() {
  const { user } = useAuth();

  /**
   * Fetches and returns all tables for a given projectId.
   */
  const fetchTables = useCallback(async (projectId: string): Promise<BetterTable[]> => {
    if (!user || !projectId) return [];

    try {
      const { data, error } = await supabase
        .from('better_tables')
        .select(`*, better_sheets!better_sheets_table_id_fkey(id, rows!rows_sheet_id_fkey(id))`)
        .eq('project_id', projectId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const tablesWithRowCounts = (data || []).map(table => {
        const rowCount = table.better_sheets?.reduce((total, sheet) => total + (sheet.rows?.length || 0), 0) || 0;
        return { ...table, row_count: rowCount };
      });

      return tablesWithRowCounts; // <-- Return the data

    } catch (err: any) {
      console.error('Error fetching tables:', err);
      toast.error('Failed to fetch tables');
      return []; // Return empty array on error
    }
  }, [user]);

  /**
   * Creates a new table.
   */
  const createTable = useCallback(async (tableData: {
    projectId: string;
    name: string;
    description?: string;
  }): Promise<BetterTable | null> => {
    if (!user || !tableData.projectId) return null;

    try {
      let finalName = tableData.name;
      if (tableData.name === 'New Table' || tableData.name.includes('New Table (')) {
        finalName = `New Table ${nanoid(6)}`;
      }

      const { data, error } = await supabase
        .from('better_tables')
        .insert([{
          name: finalName,
          description: tableData.description,
          project_id: tableData.projectId,
          user_id: user.id
        }])
        .select()
        .single();

      if (error) throw error;
      
      toast.success(`Table "${finalName}" created successfully!`);
      return data;

    } catch (error: any) {
      console.error('Error creating table:', error);
      if (error.code === '25505') {
        toast.error('A table with this name already exists in this project.');
      } else {
        toast.error('Failed to create table.');
      }
      return null;
    }
  }, [user]);

  /**
   * Updates an existing table.
   */
  const updateTable = useCallback(async (tableId: string, updates: Partial<BetterTable>): Promise<boolean> => {
    if (!user) return false;
    try {
      const { error } = await supabase
        .from('better_tables')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', tableId);
        
      if (error) throw error;
      
      toast.success('Table updated successfully!');
      return true;
    } catch (error: any) {
      console.error('Error updating table:', error);
      toast.error('Failed to update table.');
      return false;
    }
  }, [user]);

  /**
   * Deletes a table and its contents.
   */
  const deleteTable = useCallback(async (tableId: string, showToast: boolean = true): Promise<boolean> => {
    if (!user) return false;
    try {
      const { data: sheets, error: sheetsError } = await supabase.from('better_sheets').select('id').eq('table_id', tableId);
      if (sheetsError) throw new Error('Failed to fetch table sheets for deletion');

      for (const sheet of sheets || []) {
        await deleteSheetAndContents(sheet.id);
      }

      await supabase.from('better_tables').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', tableId);
      await supabase.from('trash').insert([{ item_type: 'table', item_id: tableId, user_id: user.id }]);

      if (showToast) toast.success('Table deleted successfully');
      return true;
    } catch (error: any) {
      console.error('Error deleting table:', error);
      if (showToast) toast.error(error.message || 'Failed to delete table');
      return false;
    }
  }, [user]);


    const duplicateTable = useCallback(async (
    originalTableId: string, 
    newName: string, 
    newDescription?: string, 
    copyData: boolean = false
  ): Promise<BetterTable | null> => {
    if (!user) {
      toast.error("You must be logged in to duplicate a table.");
      return null;
    }

    try {
      // Call the database function 'duplicate_table' with the required parameters
      const { data, error } = await supabase.rpc('duplicate_table', {
        original_table_id: originalTableId,
        new_table_name: newName,
        new_table_description: newDescription,
        should_copy_data: copyData,
      });

      if (error) throw error;

      toast.success(`Table "${newName}" duplicated successfully!`);
      // The RPC should return the newly created table object
      return data;

    } catch (error: any) {
      console.error('Error duplicating table:', error);
      toast.error(`Failed to duplicate table: ${error.message}`);
      return null;
    }
  }, [user]);

  
  // Memoize the returned functions for performance.
  return useMemo(() => ({
    fetchTables,
    createTable,
    updateTable,
    deleteTable,
    duplicateTable, // <-- Add the new function here
  }), [fetchTables, createTable, updateTable, deleteTable, duplicateTable]); // <-- And here
}