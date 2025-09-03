import { supabase } from '@/lib/supabase';
import { deleteSheetAndContents } from './dbSheetService';
import { BetterTable } from '@/lib/supabase'; // <-- FIX: Import the BetterTable type
import { toast } from 'sonner';               // <-- FIX: Import the toast function
import { nanoid } from 'nanoid';               // <-- ADDED: Needed for unique names

/**
 * Performs a deep soft-delete of a single table and ALL of its contents.
 * This is a service function, not a React hook.
 * @param tableId The ID of the table to delete.
 */
export const deleteTableAndContents = async (tableId: string): Promise<void> => {
  try {
    const { data: sheets, error: sheetsError } = await supabase
      .from('better_sheets')
      .select('id')
      .eq('table_id', tableId)
      .eq('is_deleted', false);

    if (sheetsError) {
      throw new Error(`Failed to fetch sheets for table ${tableId}: ${sheetsError.message}`);
    }

    for (const sheet of sheets || []) {
      await deleteSheetAndContents(sheet.id);
    }

    const { error: tableError } = await supabase
      .from('better_tables')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', tableId);

    if (tableError) {
      throw new Error(`Failed to delete table: ${tableError.message}`);
    }
  } catch (error) {
    console.error(`Error during deep delete of table ${tableId}:`, error);
    throw error;
  }
};

/**
 * Performs a deep duplication of a table, including its structure and optionally its data.
 * This is a service function, not a React hook.
 */
export const duplicateTable = async (
  sourceTableId: string, 
  newName: string, 
  description?: string, 
  copyData: boolean = false
): Promise<BetterTable | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  try {
    const { data: sourceTable } = await supabase.from('better_tables').select('*').eq('id', sourceTableId).single();
    if (!sourceTable) throw new Error('Source table not found');

    // Create the new table
    const { data: newTable, error: createTableError } = await supabase
      .from('better_tables')
      .insert({ project_id: sourceTable.project_id, name: newName, description, user_id: user.id })
      .select()
      .single();
    if (createTableError) throw createTableError;
    if (!newTable) throw new Error('Failed to create new table');

    const { data: sourceSheets } = await supabase.from('better_sheets').select('*').eq('table_id', sourceTableId).eq('is_deleted', false);

    for (const sourceSheet of sourceSheets || []) {
      const { data: newSheet } = await supabase.from('better_sheets').insert({ table_id: newTable.id, name: sourceSheet.name, description: sourceSheet.description, user_id: user.id }).select().single();
      if (!newSheet) continue;

      const { data: sourceColumns } = await supabase.from('columns').select('*').eq('sheet_id', sourceSheet.id).eq('is_deleted', false).order('position');
      const columnMapping: { [oldId: string]: string } = {};

      for (const sourceColumn of sourceColumns || []) {
        const { data: newColumn } = await supabase.from('columns').insert({
            sheet_id: newSheet.id,
            name: sourceColumn.name,
            data_type: sourceColumn.type || sourceColumn.data_type,
            is_required: sourceColumn.required || sourceColumn.is_required,
            is_unique: sourceColumn.is_unique,
            default_value: sourceColumn.default_value,
            validation_rules: sourceColumn.validation_rules,
            config: sourceColumn.config,
            user_id: user.id
        }).select().single();
        if (newColumn) columnMapping[sourceColumn.id] = newColumn.id;
      }

      if (copyData) {
        const { data: sourceRows } = await supabase.from('rows').select('id, row_data').eq('sheet_id', sourceSheet.id).eq('is_deleted', false);
        if (sourceRows) {
            for (const sourceRow of sourceRows) {
                const { data: newRow } = await supabase.from('rows').insert({ sheet_id: newSheet.id, row_data: sourceRow.row_data, user_id: user.id }).select().single();
                // Note: cell copying logic would go here if you had a separate cells table
            }
        }
      }
    }

    toast.success(`Table "${newName}" duplicated successfully!`);
    return newTable;
    
  } catch (error: any) {
    console.error('Error duplicating table:', error);
    toast.error(error.message || 'Failed to duplicate table');
    return null;
  }
};