import React, { useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import { RowDoubleClickedEvent } from 'ag-grid-community';

import { FormattingProvider } from '@/context/FormattingContext';
import { ColumnCreationDialog } from '@/components/spreadsheet/dialogs/ColumnCreationDialog';
import { DeleteDependenciesDialog } from '@/components/shared/dialogs/DeleteDependenciesDialog';
import { ExpandedRecordDialog } from '@/components/spreadsheet/dialogs/ExpandedRecordDialog';

import { GridView } from '../../features/sheets/components/GridView';
// Make sure this path points to your new, improved SheetTopBar
import { SheetTopBar } from '../../features/sheets/components/SheetTopBar'; 
import { useSheetData } from '../../features/sheets/hooks/useSheetData';
import { useAgGridConfig } from '../../features/sheets/grid/useAgGridConfig';
import { useGridSelection } from '../../features/sheets/hooks/useGridSelection';
import { useCellEditing } from '../../features/sheets/hooks/useCellEditing';
import { useSaveStatus } from '../../features/sheets/hooks/useSaveStatus';
import { useColumnManager } from '../../features/sheets/hooks/useColumnManager';
import { useRowDeletion } from '../../features/sheets/hooks/useRowDeletion';
import { Row } from '@/lib/supabase';

interface SheetDetailProps {
  sheetId?: string;
  isFullscreen?: boolean;
}

function SheetDetailInner({ sheetId: propSheetId, isFullscreen = false }: SheetDetailProps) {
  const { tableId, sheetId: urlSheetId } = useParams<{ tableId: string; sheetId: string }>();
  const sheetId = propSheetId || urlSheetId;
  const gridRef = useRef<AgGridReact>(null);

  const [expandedRecord, setExpandedRecord] = useState<Row | null>(null);

  const { allTables, columns, rows, isLoading, error, refreshData, setRows } = useSheetData({ sheetId });
  const saveStatus = useSaveStatus();
  const columnManager = useColumnManager({ onColumnCreated: refreshData, onColumnDeleted: refreshData });
  const rowDeletion = useRowDeletion({
    onDeletionSuccess: (deletedRowIds) => {
      setRows(currentRows => currentRows.filter(row => !deletedRowIds.includes(row.id)));
    },
  });

  const { columnDefs, rowData, defaultColDef } = useAgGridConfig(columns, rows);
  const selection = useGridSelection(columns);
  const editing = useCellEditing({
    sheetId: sheetId!,
    columns,
    onSaving: saveStatus.onSaving,
    onSuccess: saveStatus.onSuccess,
    onError: () => saveStatus.onError('Failed to save changes.'),
  });

  const handleDialogClose = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      columnManager.closeDialog();
    }
  }, [columnManager]);

  const handleColumnCreated = useCallback(() => {
    columnManager.handleCreationSuccess();
  }, [columnManager]);

  const handleRowDoubleClick = (event: RowDoubleClickedEvent) => {
    if (event.data && !String(event.data.id).startsWith('empty-')) {
      setExpandedRecord(event.data);
    }
  };

  const handleOpenColumnSettings = useCallback(() => {
    if (!selection.selectedCell) {
      return;
    }
    const selectedColumn = columns.find(c => c.id === selection.selectedCell!.columnId);
    if (selectedColumn) {
      columnManager.openToEdit(selectedColumn);
    }
  }, [selection.selectedCell, columns, columnManager]);

  const handleDeleteColumn = useCallback(() => {
    if (!selection.selectedCell) return;
    const selectedColumn = columns.find(c => c.id === selection.selectedCell!.columnId);
    if (selectedColumn) {
      if (window.confirm(`Are you sure you want to delete the column "${selectedColumn.name}"? This cannot be undone.`)) {
        columnManager.handleDeleteColumn(selectedColumn.id);
      }
    }
  }, [selection.selectedCell, columns, columnManager]);

  if (isLoading) return <div>Loading Sheet...</div>;
  if (error) return <div>Error loading sheet: {error.message}</div>;

  // 👇 1. Get the currently selected rows from the grid's API.
  const selectedNodes = gridRef.current?.api.getSelectedRows() || [];

  return (
    <div className={`h-full flex flex-col bg-white ${isFullscreen ? "fixed inset-0 z-50" : ""}`}>
      {/* 👇 2. Pass the two new required props here */}
      <SheetTopBar
        savingStatus={saveStatus.status}
        selectedCellId={selection.selectedCell?.cellId}
        onAddColumn={columnManager.openToAdd}
        onDeleteRows={() => {
          rowDeletion.startDeletion(selectedNodes);
        }}
        isRowSelected={selectedNodes.length > 0}
        onOpenSettings={handleOpenColumnSettings}
        isColumnSelected={!!selection.selectedCell}
        onDeleteColumn={handleDeleteColumn}
      />
      
      <div className="flex-1 p-4 bg-gray-50">
        {columns.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p>This sheet has no columns. Add one to get started!</p>
          </div>
        ) : (
          <GridView
            ref={gridRef}
            columnDefs={columnDefs}
            rowData={rowData}
            defaultColDef={defaultColDef}
            onCellClicked={selection.handleCellClicked}
            onCellValueChanged={editing.onCellValueChanged}
            onRowDoubleClicked={handleRowDoubleClick}
            suppressClickEdit={true} 
          />
        )}
      </div>

      <ColumnCreationDialog
        open={columnManager.isDialogOpen}
        onOpenChange={handleDialogClose}
        sheetId={sheetId!}
        editingColumn={columnManager.editingColumn}
        onColumnCreated={handleColumnCreated}
        availableTables={allTables}
      />

      <DeleteDependenciesDialog
        open={rowDeletion.isDependencyDialogOpen}
        onOpenChange={(isOpen) => !isOpen && rowDeletion.cancelDeletion()}
        recordName={rowDeletion.dependencyDialogData.recordName}
        dependencies={rowDeletion.dependencyDialogData.dependencies}
        onDeleteAnyway={() => rowDeletion.confirmDeletion(rowDeletion.rowsPendingDeletion)}
      />

      <ExpandedRecordDialog
        open={!!expandedRecord}
        onClose={() => setExpandedRecord(null)}
        record={expandedRecord}
        columns={columns}
      />
    </div>
  );
}

export function SheetDetail(props: SheetDetailProps) {
  return (
    <FormattingProvider>
      <SheetDetailInner {...props} />
    </FormattingProvider>
  );
}