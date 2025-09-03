import { useState, useCallback } from 'react';
import { CellClickedEvent } from 'ag-grid-community';
import { Column } from '@/lib/supabase';
import { useFormatting } from '@/context/FormattingContext';

// [FIX] Corrected the import path to navigate from `features/sheets/components/hooks` up to `src` and then down to `grid`.
import { getCellId } from '../grid/excelAddressing'

// Define the shape of the selected cell info for this hook's internal state
export interface SelectedCell {
  cellId: string;
  rowIndex: number;
  colIndex: number;
  columnId: string;
  value: any;
}

/**
 * Manages the state of the currently selected cell in the grid.
 */
export function useGridSelection(columns: Column[]) {
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  
  const { selectCell: selectCellInContext } = useFormatting();

  const handleCellClicked = useCallback((event: CellClickedEvent) => {
    const columnId = event.colDef?.field;
    
    if (!columnId || event.rowIndex === null) {
      setSelectedCell(null);
      return;
    }

    const colIndex = columns.findIndex(col => col.id === columnId);
    if (colIndex < 0) return;

    const cellId = getCellId(event.rowIndex, colIndex);
    
    const cellInfo: SelectedCell = {
      cellId,
      rowIndex: event.rowIndex,
      colIndex,
      columnId,
      value: event.value,
    };

    setSelectedCell(cellInfo);
    
    selectCellInContext({
      cellId: cellInfo.cellId,
      rowIndex: cellInfo.rowIndex,
      columnIndex: cellInfo.colIndex,
      columnId: cellInfo.columnId,
      value: cellInfo.value,
      formatting: {}, 
      formula: '',
    });

  }, [columns, selectCellInContext]);

  return {
    selectedCell,
    handleCellClicked,
  };
}