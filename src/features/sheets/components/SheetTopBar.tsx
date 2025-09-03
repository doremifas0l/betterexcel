import React from 'react';
import { Plus, Trash2, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SaveStatus } from '../hooks/useSaveStatus';

/**
 * [IMPROVEMENT] Added new props:
 * - `onOpenSettings`: Handler for the new settings button.
 * - `isRowSelected`: A boolean to determine if the delete button should be enabled,
 * improving user experience by preventing pointless clicks.
 */
interface SheetTopBarProps {
  savingStatus: SaveStatus;
  selectedCellId?: string | null;
  isRowSelected: boolean; 
  onAddColumn: () => void;
  onDeleteRows: () => void;
  onOpenSettings: () => void;
}

/**
 * [IMPROVEMENT] The logic for displaying the save status is moved into a
 * configuration object. This makes the JSX much cleaner, easier to read,
 * and simpler to update with new statuses in the future.
 */
const STATUS_CONFIG: Record<SaveStatus, { icon: React.ReactNode; text: string; className: string; }> = {
  saving: {
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    text: 'Saving...',
    className: 'text-blue-600',
  },
  saved: {
    icon: <div className="h-3 w-3 bg-green-500 rounded-full"></div>,
    text: 'Saved',
    className: 'text-green-600',
  },
  error: {
    icon: <div className="h-3 w-3 bg-red-500 rounded-full"></div>,
    text: 'Error',
    className: 'text-red-600',
  },
  idle: {
    icon: null,
    text: '',
    className: '',
  }
};

/**
 * A fully-featured top action bar for the sheet. It provides user controls
 * for modifying the sheet structure and gives real-time feedback on data persistence.
 */
export function SheetTopBar({
  savingStatus,
  selectedCellId,
  isRowSelected,
  onAddColumn,
  onDeleteRows,
  onOpenSettings,
}: SheetTopBarProps) {
  const currentStatus = STATUS_CONFIG[savingStatus] || STATUS_CONFIG.idle;

  return (
    <header className="flex items-center justify-between flex-shrink-0 px-4 py-2 bg-white border-b border-gray-200">
      {/* Action Buttons Group */}
      <div className="flex items-center gap-2">
        <Button onClick={onAddColumn} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Column
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onDeleteRows}
          disabled={!isRowSelected} // UX: Button is disabled if no rows are selected
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Rows
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={onOpenSettings}
          aria-label="View and edit column settings" // Accessibility: Label for screen readers
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Status Indicators Group */}
      <div className="flex items-center gap-4">
        <div
          className={`flex items-center gap-2 text-xs font-medium min-w-[80px] ${currentStatus.className}`}
          aria-live="polite" // Accessibility: Notifies screen readers of status changes
        >
          {currentStatus.icon}
          <span>{currentStatus.text}</span>
        </div>

        <span className="text-sm text-gray-500 min-w-[120px] text-right">
          {selectedCellId ? `Selected: ${selectedCellId}` : ''}
        </span>
      </div>
    </header>
  );
}