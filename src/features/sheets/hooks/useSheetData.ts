import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Project, BetterTable, BetterSheet, Column, Row } from '@/lib/supabase';
import { toast } from 'sonner';

// Import the stateless utility hooks
import { useProjects } from '@/hooks/data/useProjects';
import { useTables } from '@/hooks/data/useTables';
import { useSheets } from './useSheets';
import { useColumns } from './useColumns';
import { useRows } from './useRows';

interface UseSheetDataProps {
  sheetId?: string;
}

export function useSheetData({ sheetId: propSheetId }: UseSheetDataProps = {}) {
  const { projectId, tableId, sheetId: urlSheetId } = useParams<{ projectId: string; tableId: string; sheetId: string }>();
  const navigate = useNavigate();
  const sheetId = propSheetId || urlSheetId;

  // --- Initialize Stateless Utility Hooks ---
  // [THE FIX] We initialize the hooks themselves WITHOUT arguments.
const { fetchProjects } = useProjects();
const { fetchTables } = useTables();
const { fetchSheets } = useSheets();
const { fetchColumns } = useColumns();
const { fetchRows } = useRows();
  
  // --- This hook is the single source of truth for ALL page state ---
  const [project, setProject] = useState<Project | null>(null);
  const [table, setTable] = useState<BetterTable | null>(null);
  const [sheet, setSheet] = useState<BetterSheet | null>(null);
  const [allTables, setAllTables] = useState<BetterTable[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const channelRef = useRef<any>(null);

  const loadData = useCallback(async () => {
    if (!sheetId || !projectId || !tableId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // [THE FIX] We call the fetch functions WITH the required IDs here.
      // These functions now RETURN data, which we use to set our state.
      const [
        allProjectsData,
        allTablesData,
        allSheetsData,
        columnsData,
        rowsData,
      ] = await Promise.all([
        fetchProjects(),
        fetchTables(projectId),
        fetchSheets(tableId),
        fetchColumns(sheetId), 
        fetchRows(sheetId),
      ]);
      
      // [THE FIX] The 'find' method now works because allProjectsData is a valid array.
      setProject(allProjectsData.find(p => p.id === projectId) || null);
      setAllTables(allTablesData);
      setTable(allTablesData.find((t) => t.id === tableId) || null);
      setSheet(allSheetsData.find(s => s.id === sheetId) || null);
      setColumns(columnsData);
      setRows(rowsData);

    } catch (err: any) {
      setError(err);
      toast.error(`Failed to load sheet data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [sheetId, projectId, tableId, fetchProjects, fetchTables, fetchSheets, fetchColumns, fetchRows]);
  
  useEffect(() => {
    if (sheetId) {
      loadData();
    }
    const channel = supabase.channel(`realtime-sheet:${sheetId}`);
    channel.on(
      'postgres_changes', 
      { event: '*', schema: 'public', table: 'rows', filter: `sheet_id=eq.${sheetId}` }, 
      (payload) => {
        setRows(currentRows => {
          // [THE FIX] The updater function must return the new state.
          switch (payload.eventType) {
            case 'INSERT':
              // Avoid duplicates from optimistic updates
              if (currentRows.some(row => row.id === payload.new.id)) {
                return currentRows;
              }
              return [...currentRows, payload.new as Row];
            case 'UPDATE':
              return currentRows.map(row => (row.id === payload.new.id ? { ...row, ...payload.new } as Row : row));
            case 'DELETE':
              return currentRows.filter(row => row.id !== (payload.old as { id: string }).id);
            default:
              return currentRows;
          }
        });
      }
    ).subscribe();
    
    return () => { supabase.removeChannel(channel) };
  }, [sheetId, loadData]);

  const handleSheetDeleted = useCallback(async () => {
    if (!tableId) return;
    toast.info('Refreshing sheet list...');
    try {
      // [THE FIX] Pass the required tableId to fetchSheets.
      const remainingSheets = await fetchSheets(tableId);
      if (remainingSheets && remainingSheets.length > 0) {
        navigate(`/project/${projectId}/table/${tableId}/sheet/${remainingSheets[0].id}`);
      } else {
        navigate(`/project/${projectId}/table/${tableId}`);
      }
    } catch (error) {
      console.error('Error navigating after sheet deletion:', error);
      toast.error('Could not refresh sheets.');
    }
  }, [navigate, projectId, tableId, fetchSheets]);
  
  const memoizedReturn = useMemo(() => ({
    sheetId,
    projectId,
    tableId,
    project,
    table,
    sheet,
    allTables,
    columns,
    rows,
    setRows,
    setColumns,
    isLoading,
    error,
    refreshData: loadData,
    handleSheetDeleted,
  }), [
    sheetId, projectId, tableId, project, table, sheet, allTables, 
    columns, rows, setRows, setColumns, isLoading, error, 
    loadData, handleSheetDeleted
  ]);

  return memoizedReturn;
}