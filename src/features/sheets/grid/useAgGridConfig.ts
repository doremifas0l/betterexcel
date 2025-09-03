import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ColDef, ValueParserParams } from 'ag-grid-community';
import { Column, Row, SelectOption } from '@/lib/supabase';
import { useSheetRepo } from '../services/SheetRepo';
import { TypeAwareCellRenderer } from '@/components/grid/TypeAwareCellRenderer';


interface GridLinkConfig {
  target_table_id: string;
  display_column_id: string;
}

interface RollupConfiguration {
  id: string;
  source_link_column_id: string;
  source_field_column_id: string;
  aggregation_function: string;
}

const MIN_VISIBLE_ROWS = 20;

function getColumnLetter(index: number): string {
  let letter = '';
  while (index >= 0) {
    letter = String.fromCharCode(65 + (index % 26)) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
}

export function useAgGridConfig(columns: Column[], rows: Row[]) {
  // ✨ FIX: Removed fetchLinkConfiguration and fetchRollupConfiguration as they don't exist on the hook yet.
  const { fetchSelectOptions } = useSheetRepo();
  
  const [columnDefs, setColumnDefs] = useState<ColDef[]>([]);
  const [rowData, setRowData] = useState<any[]>([]);

  const defaultColDef = useMemo<ColDef>(() => ({
    width: 200,
    minWidth: 120,
    resizable: true,
    sortable: true,
    filter: true,
    editable: true,
    cellClass: 'ag-cell',
  }), []);

  const buildColDefs = useCallback(
    (
      columnsData: Column[],
      selectOptions: Record<string, SelectOption[]> = {},
      // Keep these parameters for future use, even if we don't populate them yet.
      linkConfigs: Record<string, GridLinkConfig> = {},
      rollupConfigs: Record<string, RollupConfiguration> = {}
    ) => {
      const colDefs: ColDef[] = [];
      
      colDefs.push({
        field: 'rowNumber', headerName: '#', width: 60, pinned: 'left',
        valueGetter: (params) => (params.node?.rowIndex != null ? params.node.rowIndex + 1 : ''),
        editable: false, sortable: false, filter: false, resizable: false,
      });

      const sorted = [...columnsData].sort((a, b) => (a.position || 0) - (b.position || 0));

      for (const [index, col] of sorted.entries()) {
        const columnLetter = getColumnLetter(index);
        const colDef: ColDef = {
          field: col.id,
          headerName: `${columnLetter} - ${col.name}`,
          colId: col.id,
          headerTooltip: `${columnLetter}: ${col.name}${col.is_required ? ' (Required)' : ''}`,
          cellRenderer: TypeAwareCellRenderer,
          cellRendererParams: {
            dataType: col.data_type,
            options: col.data_type === 'select' ? (selectOptions[col.id] || []) : undefined,
            linkConfig: col.data_type === 'link' ? (linkConfigs[col.id]) : undefined,
            rollupConfig: col.data_type === 'rollup' ? (rollupConfigs[col.id]) : undefined,
          },
        };

        switch (col.data_type) {
            case 'number':
              colDef.cellEditor = 'agNumberCellEditor';
              colDef.valueParser = (params: ValueParserParams) => params.newValue != null ? String(params.newValue) : null;
              break;
            case 'select': {
              const options = selectOptions[col.id] || [];
              colDef.cellEditor = 'agSelectCellEditor';
              colDef.cellEditorParams = { values: options.map((opt) => opt.option_value) };
              break;
            }
            case 'checkbox':
              colDef.cellEditor = 'agCheckboxCellEditor';
              colDef.cellClass = 'ag-cell ag-cell-checkbox-center';
              colDef.valueParser = (params: ValueParserParams) => params.newValue ? 'true' : 'false';
              break;
            case 'date':
            case 'datetime':
              colDef.cellEditor = 'agDateCellEditor';
              colDef.valueParser = (params: ValueParserParams) => {
                if (!params.newValue) return null;
                try {
                  const date = new Date(params.newValue);
                  return date.toISOString();
                } catch (e) {
                  return params.oldValue;
                }
              };
              break;
            case 'textarea':
              colDef.cellEditor = 'agLargeTextCellEditor';
              break;
            case 'link':
              colDef.editable = false; 
              break;
            case 'rollup':
            case 'computed':
              colDef.editable = false;
              break;
            default: // 'text'
              colDef.cellEditor = 'agTextCellEditor';
              break;
        }
        colDefs.push(colDef);
      }
      return colDefs;
    },
    [] 
  );

  const buildGridRows = useCallback((columnsToProcess: Column[], rowsData: Row[]) => {
    const gridRows: any[] = [];
    const maxOrder = rowsData.reduce((max, r) => Math.max(max, r.row_order || 0), 0);
    const totalGridRows = Math.max(MIN_VISIBLE_ROWS, maxOrder + 10);
    const rowMap = new Map<number, Row>();
    rowsData.forEach((r) => r.row_order != null && rowMap.set(r.row_order, r));

    for (let i = 0; i < totalGridRows; i++) {
      const realRow = rowMap.get(i);
      if (realRow) {
        const rowObj: any = { 
          id: realRow.id, 
          _rowId: realRow.id, 
          row_order: realRow.row_order,
          row_data: realRow.row_data
        };
        columnsToProcess.forEach((col) => {
          rowObj[col.id] = realRow.row_data?.[col.id] ?? '';
        });
        gridRows.push(rowObj);
      } else {
        const emptyRow: any = { id: `empty-${i}`, _rowId: `empty-${i}`, row_order: i };
        columnsToProcess.forEach((col) => (emptyRow[col.id] = ''));
        gridRows.push(emptyRow);
      }
    }
    return gridRows;
  }, []);
  
  useEffect(() => {
    const setupGrid = async () => {
        if (!columns || columns.length === 0) {
            setColumnDefs([]);
            setRowData([]);
            return;
        }

        const selectPromises = columns.filter(c => c.data_type === 'select').map(c => fetchSelectOptions(c.id).then(opts => ({ id: c.id, opts })));
        
        // ✨ FIX: Temporarily disable fetching for link and rollup configs.
        // const linkPromises = columns.filter(c => c.data_type === 'link').map(c => fetchLinkConfiguration(c.id).then(cfg => ({ id: c.id, cfg })));
        // const rollupPromises = columns.filter(c => c.data_type === 'rollup').map(c => fetchRollupConfiguration(c.id).then(cfg => ({ id: c.id, cfg })));

        const [selectResults] = await Promise.all([
            Promise.all(selectPromises),
            // Promise.all(linkPromises),
            // Promise.all(rollupPromises),
        ]);

        const selectOptionsMap = Object.fromEntries(selectResults.map(r => [r.id, r.opts]));
        // const linkConfigsMap = Object.fromEntries(linkResults.filter(r => r.cfg).map(r => [r.id, r.cfg as GridLinkConfig]));
        // const rollupConfigsMap = Object.fromEntries(rollupResults.filter(r => r.cfg).map(r => [r.id, r.cfg!]));

        // ✨ FIX: Pass empty objects for the disabled configs.
        const newColDefs = buildColDefs(columns, selectOptionsMap, {}, {});
        const newRowData = buildGridRows(columns, rows);

        setColumnDefs(newColDefs);
        setRowData(newRowData);
    };
    setupGrid();
  }, [columns, rows, buildColDefs, buildGridRows, fetchSelectOptions]); // ✨ FIX: Removed dependencies that are no longer used.

  return { columnDefs, rowData, setRowData, defaultColDef };
}

