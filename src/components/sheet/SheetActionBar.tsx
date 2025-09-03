import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Settings, Trash2 } from 'lucide-react';

/**
 * A type definition for the saving status indicator.
 */
export type SavingStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Props for the SheetActionBar component. It accepts all the necessary data
 * to display and functions to call when buttons are clicked.
 */
interface SheetActionBarProps {
  savingStatus: SavingStatus;
  selectedCellId: string | null;
  columnCount: number;
  onAddColumn: () => void;
  onAddRows: () => void;
  onColumnSettings: () => void;
  onDeleteRows: () => void;
  onSheetSettings: () => void;
}

/**
 * Renders the action bar above the sheet grid.
 * This component is purely presentational and receives all its state and handlers via props.
 */
export const SheetActionBar = ({
  savingStatus,
  selectedCellId,
  columnCount,
  onAddColumn,
  onAddRows,
  onColumnSettings,
  onDeleteRows,
  onSheetSettings,
}: SheetActionBarProps) => {
  return (
    <div className="flex items-center justify-between flex-shrink-0 px-4 py-2 bg-white border-b border-gray-200 shadow-sm">
      {/* Left side actions */}
      <div className="flex items-center space-x-2">
        <Button onClick={onAddColumn} size="sm" className="bg-green-600 hover:bg-green-700 text-white">
          <Plus className="h-4 w-4 mr-1" /> Add Column
        </Button>

        <Button onClick={onAddRows} size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" /> Add Rows
        </Button>

        <Button onClick={onColumnSettings} size="sm" variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
          <Settings className="h-4 w-4 mr-1" /> Column Settings
        </Button>

        <Button onClick={onDeleteRows} className="text-red-600 hover:text-red-700 hover:bg-red-50" variant="ghost" size="sm">
          <Trash2 className="h-4 w-4 mr-1" /> Delete Rows
        </Button>
      </div>

      {/* Right side status and actions */}
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1 min-w-[80px]">
            {savingStatus === 'saving' && (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600" />
                <span className="text-xs text-blue-600 font-medium">Saving...</span>
              </>
            )}
            {savingStatus === 'saved' && (
              <>
                <div className="h-3 w-3 bg-green-500 rounded-full" />
                <span className="text-xs text-green-600 font-medium">Saved</span>
              </>
            )}
            {savingStatus === 'error' && (
              <>
                <div className="h-3 w-3 bg-red-500 rounded-full" />
                <span className="text-xs text-red-600 font-medium">Error</span>
              </>
            )}
          </div>
          <span className="text-sm text-gray-500">
            {selectedCellId ? `Selected: ${selectedCellId}` : `Columns: ${columnCount}`}
          </span>
        </div>

        <Button variant="ghost" size="sm" onClick={onSheetSettings}>
          <Settings className="h-4 w-4 mr-1" /> Sheet Settings
        </Button>
      </div>
    </div>
  );
};