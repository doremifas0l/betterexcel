import { useCallback } from 'react';
import { CellValueChangedEvent } from 'ag-grid-community';
import { useRows } from './useRows';
import { Column } from '@/lib/supabase';

interface UseCellEditingProps {
  sheetId: string;
  columns: Column[];
  onSuccess: () => void;
  onError: () => void;
  onSaving: () => void;
}

export function useCellEditing({
  sheetId,
  columns,
  onSuccess,
  onError,
  onSaving,
}: UseCellEditingProps) {
  const { createRow, updateRow } = useRows();

  const onCellValueChanged = useCallback(async (params: CellValueChangedEvent) => {
    // Don't save if the value hasn't actually changed.
    if (params.newValue === params.oldValue) {
      return;
    }
    
    onSaving();

    const columnId = params.colDef.colId;
    if (!columnId) return onError();

    const rowId = params.data._rowId;

    try {
      if (String(rowId).startsWith('empty-')) {
        // --- CREATE NEW ROW LOGIC (This logic is already correct) ---
        const newRowData: { [key: string]: any } = {};
        columns.forEach(col => {
          if (params.data[col.id] !== undefined) {
            newRowData[col.id] = params.data[col.id];
          }
        });
        
        const rowOrder = params.data.row_order;
        const createdRow = await createRow(sheetId, newRowData, rowOrder);

        if (createdRow) {
          params.node.setData({ ...params.data, _rowId: createdRow.id, id: createdRow.id, row_data: createdRow.row_data });
          onSuccess();
        } else {
          throw new Error("Row creation failed.");
        }

      } else {
        // --- ✨ THE FIX: A simpler and more robust way to update existing rows ---
        
        // 1. Get the existing data from the `row_data` property.
        const existingData = params.data.row_data || {};

        // 2. Create the new payload by merging the single changed value.
        const updatedPayload = {
          ...existingData,
          [columnId]: params.newValue,
        };
        
        // 3. Send the clean payload to the database.
        const success = await updateRow(rowId, updatedPayload);

        if (success) {
          // 4. Update the grid's client-side data to stay in sync.
          params.node.setDataValue(columnId, params.newValue);
          params.node.setData({ ...params.data, row_data: updatedPayload });
          onSuccess();
        } else {
          throw new Error("Row update failed.");
        }
      }
    } catch (error) {
      console.error('Error saving cell value:', error);
      // Revert the cell's value in the UI on failure
      params.node.setDataValue(columnId, params.oldValue);
      onError();
    }
  }, [sheetId, columns, createRow, updateRow, onSaving, onSuccess, onError]);

  return { onCellValueChanged };
}