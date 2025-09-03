import { useState, useCallback } from 'react';
import { toast } from 'sonner';

// [THE FIX] Import the specific, small hooks this hook needs for its logic.
import { useValidation } from '@/hooks/utils/useValidation';
import { useRows } from './useRows'; // Use the local, feature-specific useRows hook

// Define the shape of the dependency dialog's state for clarity
interface DependencyDialogState {
  isOpen: boolean;
  recordName: string;
  rowsToDelete: any[]; // Store the rows that are pending deletion
  dependencies: any[]; // Store the dependency info from the validation
}

// Define the props that the parent component must provide to this hook
interface UseRowDeletionProps {
  // sheetId: string; // No longer needed
  onDeletionSuccess: (deletedRowIds: string[]) => void;
}
/**
 * Manages the entire row deletion workflow, including dependency checks
 * and confirmation dialogs.
 */
export function useRowDeletion({  onDeletionSuccess }: UseRowDeletionProps) {
  // Initialize the smaller hooks with the required context (sheetId)
  const { validateRowBeforeDeletion } = useValidation();
  const { deleteRows } = useRows(); // Assuming useRows exposes deleteRows

  const [dialogState, setDialogState] = useState<DependencyDialogState>({
    isOpen: false,
    recordName: '',
    rowsToDelete: [],
    dependencies: [],
  });

  /**
   * The function that performs the actual deletion after confirmation.
   * This is called either directly or from the confirmation dialog.
   */
  const confirmDeletion = useCallback(async (rowsToDelete: any[]) => {
    try {
      const rowIds = rowsToDelete.map(r => r._rowId);
      if (rowIds.length === 0) return;

      // Use the deleteRows function from the useRows hook
      await deleteRows(rowIds); 

      toast.success(`Successfully deleted ${rowIds.length} row(s).`);
      
      // Notify the parent component so it can update its state
      onDeletionSuccess(rowIds);

    } catch (error: any) {
      toast.error(`Failed to delete rows: ${error.message}`);
    } finally {
      // Always close the dialog after the operation is attempted
      closeDialog();
    }
  }, [deleteRows, onDeletionSuccess]);

  /**
   * Initiates the deletion process for a given set of selected rows from the grid.
   */
  const startDeletion = useCallback(async (selectedRows: any[]) => {
    if (!selectedRows || selectedRows.length === 0) {
      toast.error('Please select rows to delete.');
      return;
    }

    // Filter out any "empty" placeholder rows that don't exist in the database
    const realRows = selectedRows.filter(row => row._rowId && !String(row._rowId).startsWith('empty-'));

    if (realRows.length === 0) {
      toast.info('No database rows selected to delete.');
      return;
    }
    
    // For simplicity, we'll validate the first selected row.
    const firstRow = realRows[0];
    const rowId = firstRow._rowId;

    try {
      // Use the validation function from the useValidation hook
      const validation = await validateRowBeforeDeletion(rowId);

      if (!validation.canDelete && validation.dependencies.length > 0) {
        // Dependencies were found, so we open the confirmation dialog
        setDialogState({
          isOpen: true,
          recordName: `Row ${rowId}`, // A better display name could be generated
          rowsToDelete: realRows,
          dependencies: validation.dependencies,
        });
      } else {
        // No dependencies were found, so we proceed directly to deletion
        await confirmDeletion(realRows);
      }
    } catch (error: any) {
      toast.error(`Validation failed: ${error.message}`);
    }
  }, [validateRowBeforeDeletion, confirmDeletion]);

  /**
   * A simple callback to close the dialog and reset its state.
   */
  const closeDialog = useCallback(() => {
    setDialogState({ isOpen: false, recordName: '', rowsToDelete: [], dependencies: [] });
  }, []);

  // Expose all the necessary state and functions for the UI to consume
  return {
    isDependencyDialogOpen: dialogState.isOpen,
    dependencyDialogData: {
      recordName: dialogState.recordName,
      dependencies: dialogState.dependencies,
    },
    rowsPendingDeletion: dialogState.rowsToDelete,
    startDeletion,
    confirmDeletion,
    cancelDeletion: closeDialog,
  };
}