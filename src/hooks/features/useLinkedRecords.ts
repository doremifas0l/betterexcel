import { useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { LinkConfiguration } from '@/lib/supabase'; // Ensure this type is defined and exported

/**
 * Provides all functions for managing the "Linked Record" column feature.
 */
export function useLinkedRecords() {
  const { user } = useAuth();

  /**
   * Creates the configuration entry for a new linked record column.
   */
  const createLinkConfiguration = useCallback(async (linkConfig: {
    column_id: string;
    target_table_id: string;
    display_column_id?: string;
  }): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase.from('link_configurations').insert([{ ...linkConfig, user_id: user.id }]);
    if (error) {
      console.error('Error creating link configuration:', error);
      toast.error('Failed to create link configuration');
      return false;
    }
    return true;
  }, [user]);

  /**
   * Fetches the configuration for a specific linked record column.
   */
  const fetchLinkConfiguration = useCallback(async (columnId: string): Promise<LinkConfiguration | null> => {
    if (!user) return null;
    const { data, error } = await supabase.from('link_configurations').select('*').eq('column_id', columnId).single();
    if (error) {
      // This is a common operation, so logging without a toast is often better.
      console.error('Error fetching link configuration:', error);
      return null;
    }
    return data;
  }, [user]);

  /**
   * Fetches all possible records from a target table that can be linked to.
   */
  const fetchLinkableRecords = useCallback(async (targetTableId: string, displayColumnId?: string): Promise<{ id: string; display_value: string }[]> => {
    if (!user) return [];
    try {
      const { data: sheets } = await supabase.from('better_sheets').select('id').eq('table_id', targetTableId).eq('is_deleted', false);
      if (!sheets?.length) return [];

      const allRecords: { id: string; display_value: string }[] = [];
      for (const sheet of sheets) {
        const { data: rows } = await supabase.from('rows').select('id, row_data').eq('sheet_id', sheet.id).eq('is_deleted', false);
        if (!rows) continue;

        for (const row of rows) {
          let displayValue = row.id; // Fallback to the row's unique ID
          if (displayColumnId && row.row_data?.[displayColumnId]) {
            displayValue = row.row_data[displayColumnId];
          } else if (row.row_data) {
            const firstValue = Object.values(row.row_data).find(val => val && val.toString().trim());
            if (firstValue) displayValue = firstValue.toString();
          }
          allRecords.push({ id: row.id, display_value: displayValue });
        }
      }
      return allRecords;
    } catch (error) {
      console.error('Error fetching linkable records:', error);
      return [];
    }
  }, [user]);

  /**
   * Resolves a linked row ID to its display value. Returns '#REF' on failure.
   */
  const resolveLinkValue = useCallback(async (linkedRowId: string, displayColumnId?: string): Promise<string | null> => {
    if (!user || !linkedRowId) return null;
    try {
      const { data: row } = await supabase.from('rows').select('row_data').eq('id', linkedRowId).single();
      if (!row) return '#REF'; // The linked record was deleted or doesn't exist.

      if (displayColumnId && row.row_data?.[displayColumnId]) {
        return row.row_data[displayColumnId].toString();
      }
      const firstValue = Object.values(row.row_data).find(val => val && val.toString().trim());
      return firstValue ? firstValue.toString() : linkedRowId; // Fallback to ID if no other value is found
    } catch (error) {
      // This can happen if the row is not found, which is a valid state (broken link).
      return '#REF';
    }
  }, [user]);

  /**
   * Creates a new record in a target table and returns it in a linkable format.
   */
  const createLinkedRecord = useCallback(async (targetTableId: string, recordData: any): Promise<{ id: string; display_value: string } | null> => {
    if (!user) return null;
    try {
      const { data: sheets } = await supabase.from('better_sheets').select('id').eq('table_id', targetTableId).limit(1);
      if (!sheets?.length) {
        toast.error('Target table has no sheets to add data to.');
        return null;
      }
      const { data: newRow, error } = await supabase.from('rows').insert([{ sheet_id: sheets[0].id, row_data: recordData, user_id: user.id }]).select().single();
      if (error) throw error;
      
      const displayValue = Object.values(recordData)[0]?.toString() || newRow.id;
      return { id: newRow.id, display_value: displayValue };
    } catch (error) {
      toast.error('Failed to create linked record');
      return null;
    }
  }, [user]);

  /**
   * Removes a link value from a cell by updating the row's JSONB data.
   */
  const removeLinkFromCell = useCallback(async (rowId: string, columnId: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const { data: currentRow } = await supabase.from('rows').select('row_data').eq('id', rowId).single();
      if (!currentRow) throw new Error('Row not found');
      
      const updatedRowData = { ...currentRow.row_data };
      delete updatedRowData[columnId];
      
      const { error } = await supabase.from('rows').update({ row_data: updatedRowData }).eq('id', rowId);
      if (error) throw error;
      return true;
    } catch (error) {
      toast.error('Failed to remove link');
      return false;
    }
  }, [user]);

  /**
   * Updates a cell's value to a new linked record ID.
   */
  const updateLinkInCell = useCallback(async (rowId: string, columnId: string, newLinkedRowId: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const { data: currentRow } = await supabase.from('rows').select('row_data').eq('id', rowId).single();
      if (!currentRow) throw new Error('Row not found');
      
      const updatedRowData = { ...currentRow.row_data, [columnId]: newLinkedRowId };
      
      const { error } = await supabase.from('rows').update({ row_data: updatedRowData }).eq('id', rowId);
      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('Error updating link:', error);
      toast.error('Failed to update link');
      return false;
    }
  }, [user]);

  /**
   * Scans a sheet for links in a specific column that point to deleted records and removes them.
   */
  const resolveBrokenLinks = useCallback(async (sheetId: string, columnId: string): Promise<{ totalBroken: number; resolved: number }> => {
    if (!user) return { totalBroken: 0, resolved: 0 };
    try {
      const { data: rows } = await supabase.from('rows').select('id, row_data').eq('sheet_id', sheetId).eq('is_deleted', false);
      if (!rows) return { totalBroken: 0, resolved: 0 };

      let totalBroken = 0;
      let resolved = 0;

      for (const row of rows) {
        const linkedRowId = row.row_data?.[columnId];
        if (linkedRowId) {
          const { data: linkedRow } = await supabase.from('rows').select('id').eq('id', linkedRowId).maybeSingle();
          if (!linkedRow) {
            totalBroken++;
            const updatedRowData = { ...row.row_data };
            delete updatedRowData[columnId];
            const { error } = await supabase.from('rows').update({ row_data: updatedRowData }).eq('id', row.id);
            if (!error) resolved++;
          }
        }
      }
      if (resolved > 0) toast.success(`Resolved ${resolved} broken link(s)`);
      return { totalBroken, resolved };
    } catch (error) {
      toast.error('Failed to resolve broken links');
      return { totalBroken: 0, resolved: 0 };
    }
  }, [user]);


  const fetchTargetTableColumns = useCallback(async (targetTableId: string): Promise<{ id: string; name: string }[]> => {
    if (!user || !targetTableId) return [];

    try {
      // Step 1: Find all sheets associated with the target table.
      const { data: sheets, error: sheetsError } = await supabase
        .from('better_sheets')
        .select('id')
        .eq('table_id', targetTableId)
        .eq('is_deleted', false);

      if (sheetsError) throw sheetsError;
      if (!sheets || sheets.length === 0) return [];

      const sheetIds = sheets.map(s => s.id);

      // Step 2: Fetch all columns that belong to those sheets.
      const { data: columns, error: columnsError } = await supabase
        .from('columns')
        .select('id, name')
        .in('sheet_id', sheetIds)
        .eq('is_deleted', false)
        .order('position', { ascending: true });

      if (columnsError) throw columnsError;

      return columns || [];
    } catch (error) {
      console.error("Error fetching target table columns:", error);
      // This is a non-critical fetch for UI display, so no toast is needed.
      return [];
    }
  }, [user]);
  return useMemo(() => ({
    createLinkConfiguration,
    fetchLinkConfiguration,
    fetchLinkableRecords,
    resolveLinkValue,
    createLinkedRecord,
    removeLinkFromCell,
    updateLinkInCell,
    resolveBrokenLinks,
    fetchTargetTableColumns, // <-- Add here
  }), [
    createLinkConfiguration,
    fetchLinkConfiguration,
    fetchLinkableRecords,
    resolveLinkValue,
    createLinkedRecord,
    removeLinkFromCell,
    updateLinkInCell,
    resolveBrokenLinks,
    fetchTargetTableColumns, // <-- And here
  ]);
}