import { useState, useCallback } from 'react';
import { Column } from '@/lib/supabase';
// NOTE: We don't need useAutomatedColumns for this basic functionality.
// We can add it back later if needed.

interface UseColumnManagerProps {
  onColumnCreated: () => void;
}

export function useColumnManager({ onColumnCreated }: UseColumnManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // We'll use the base Column type for now to keep it simple.
  const [editingColumn, setEditingColumn] = useState<Column | null>(null);

  const openToAdd = useCallback(() => {
    setEditingColumn(null);
    setIsDialogOpen(true);
  }, []);

  const openToEdit = useCallback((column: Column) => {
    setEditingColumn(column);
    setIsDialogOpen(true);
  }, []);
  
  // ✨ FIX #1: Implement the closeDialog logic.
  // This function now correctly updates the state to close the dialog.
  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
    setEditingColumn(null); // Also clear the editing state
  }, []);

  // ✨ FIX #2: Implement the success handler logic.
  // This function now correctly closes the dialog and calls the refresh callback.
  const handleCreationSuccess = useCallback(() => {
    closeDialog();
    onColumnCreated();
  }, [closeDialog, onColumnCreated]);

  return {
    isDialogOpen,
    editingColumn,
    openToAdd,
    openToEdit,
    closeDialog,
    handleCreationSuccess,
  };
}
