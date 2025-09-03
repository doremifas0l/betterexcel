import { supabase } from '@/lib/supabase';

/**
 * Performs a deep soft-delete of a single sheet and its contents.
 * This is a service function, not a React hook.
 * @param sheetId The ID of the sheet to delete.
 */
export const deleteSheetAndContents = async (sheetId: string): Promise<void> => {
  try {
    // Soft-delete all columns for this sheet
    // Note: In a real-world scenario with heavy load, this might be better as a single database function (RPC).
    await supabase
      .from('columns')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('sheet_id', sheetId);

    // Soft-delete all rows for this sheet
    await supabase
      .from('rows')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('sheet_id', sheetId);

    // Finally, soft-delete the sheet itself
    const { error: sheetError } = await supabase
      .from('better_sheets')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', sheetId);

    if (sheetError) {
      throw new Error(`Failed to delete sheet: ${sheetError.message}`);
    }

  } catch (error) {
    console.error(`Error during deep delete of sheet ${sheetId}:`, error);
    // Re-throw the error so the calling function knows the operation failed.
    throw error;
  }
};