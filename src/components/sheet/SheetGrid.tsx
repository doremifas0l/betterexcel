import React, { forwardRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, CellValueChangedEvent, CellFocusedEvent } from 'ag-grid-community';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Plus } from 'lucide-react';
import { Column } from '@/lib/supabase';

/**
 * Props for the SheetGrid component. It accepts grid configuration and event handlers.
 */
interface SheetGridProps {
  columns: Column[]; // The original column data, used to check for the empty state
  columnDefs: ColDef[];
  rowData: any[];
  defaultColDef: ColDef;
  onCellValueChanged: (event: CellValueChangedEvent) => void;
  onCellFocused: (event: CellFocusedEvent) => void;
  onAddFirstColumn: () => void; // A specific handler for the button in the empty state
}

/**
 * A presentational component that renders the AG Grid instance or an empty state.
 * It is wrapped in `forwardRef` to allow the parent component to access the
 * underlying AgGridReact component's API.
 */
export const SheetGrid = forwardRef<AgGridReact, SheetGridProps>(({
  columns,
  columnDefs,
  rowData,
  defaultColDef,
  onCellValueChanged,
  onCellFocused,
  onAddFirstColumn
}, ref) => {
  
  // If there are no columns, render a helpful placeholder instead of an empty grid.
  if (columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="text-center p-8">
          <FileSpreadsheet className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No columns yet</h3>
          <p className="text-gray-600 mb-4">Add some columns to start entering data in this sheet</p>
          <Button onClick={onAddFirstColumn} className="bg-green-600 hover:bg-green-700 text-white">
            <Plus className="h-4 w-4 mr-2" /> Add First Column
          </Button>
        </div>
      </div>
    );
  }

  // If columns exist, render the fully configured AG Grid.
  return (
    <div className="ag-theme-alpine h-full">
      <AgGridReact
        ref={ref}
        columnDefs={columnDefs}
        rowData={rowData}
        context={{ columns }}
        key={`${columns.length}-${rowData.length}`} // Helps React efficiently re-render the grid
        defaultColDef={defaultColDef}
        rowSelection={{ mode: 'multiRow', enableClickSelection: false, enableSelectionWithoutKeys: true }}
        headerHeight={40}
        rowHeight={32}
        domLayout="normal"
        loading={false} // Loading is now handled by the parent component
        onCellValueChanged={onCellValueChanged}
        onCellFocused={onCellFocused}
      />
    </div>
  );
});

// This helps with debugging in React Developer Tools.
SheetGrid.displayName = 'SheetGrid';