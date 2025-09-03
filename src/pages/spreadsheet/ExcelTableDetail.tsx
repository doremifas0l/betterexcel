import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExcelSheetTabs } from '@/components/spreadsheet/ExcelSheetTabs';
import { SheetDetail } from '@/components/spreadsheet/SheetDetail';
import { ExcelToolbar } from '@/components/spreadsheet/ExcelToolbar';
import { TableSettingsModal } from '@/components/spreadsheet/dialogs/TableSettingsModal';
import { DeleteConfirmationDialog } from '@/components/shared/dialogs/DeleteConfirmationDialog';
import { FullscreenProvider, useFullscreen } from '@/context/FullscreenContext';
import { Project, BetterTable, BetterSheet } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ProjectLayout } from '@/components/layout/ProjectLayout';

// --- CHANGE #1: Import the new, focused hooks ---
import { useProjects } from '@/hooks/data/useProjects';
import { useTables } from '@/hooks/data/useTables';
import { useSheets } from '@/features/sheets/hooks/useSheets';

// Inner component that uses fullscreen context
function ExcelTableDetailInner() {
  const { isFullscreen } = useFullscreen();
  const { projectId, tableId } = useParams<{ projectId: string; tableId: string }>();
  const navigate = useNavigate();

  // --- CHANGE #2: Initialize the new hooks ---
  const { fetchProjects } = useProjects();
  const { fetchTables } = useTables();
  const {
    fetchSheets,
    createSheet,
    updateSheet,
    deleteSheet,
  } = useSheets();
  
  const [project, setProject] = useState<Project | null>(null);
  const [table, setTable] = useState<BetterTable | null>(null);
  const [sheets, setSheets] = useState<BetterSheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [showTableSettings, setShowTableSettings] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; sheet?: BetterSheet }>({ open: false });
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const loadData = useCallback(async () => {
    if (!projectId || !tableId) return;
    try {
      const projectsData = await fetchProjects();
      setProject(projectsData.find(p => p.id === projectId) || null);

      const tablesData = await fetchTables(projectId);
      setTable(tablesData.find(t => t.id === tableId) || null);

      const sheetData = await fetchSheets(tableId);
      setSheets(sheetData);
      
      // Set the first sheet as active if none is selected
      if (sheetData.length > 0 && !activeSheetId) {
        setActiveSheetId(sheetData[0].id);
      } else if (sheetData.length === 0) {
        setActiveSheetId(null);
      }
    } catch (error) {
      toast.error("Could not load table data.");
      setTable(null);
    } finally {
      setInitialLoadComplete(true);
    }
  }, [projectId, tableId, activeSheetId, fetchProjects, fetchTables, fetchSheets]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshSheets = useCallback(async () => {
    if (!tableId) return;
    const data = await fetchSheets(tableId);
    setSheets(data);
  }, [tableId, fetchSheets]);

  const handleCreateSheet = async () => {
    if (!tableId) return;
    setIsCreatingSheet(true);
    try {
      const newSheet = await createSheet({ tableId, name: `Sheet ${sheets.length + 1}` });
      if (newSheet) {
        await refreshSheets();
        setActiveSheetId(newSheet.id);
      }
    } finally {
      setIsCreatingSheet(false);
    }
  };

  const handleSheetRename = async (sheetId: string, newName: string) => {
    const success = await updateSheet(sheetId, { name: newName });
    if (success) {
      await refreshSheets();
    }
    return success;
  };
  
  const handleSheetDelete = (sheet: BetterSheet) => {
    setDeleteDialog({ open: true, sheet });
  };
  
  const confirmDeleteSheet = async () => {
    if (!deleteDialog.sheet) return;
    const success = await deleteSheet(deleteDialog.sheet.id);
    if (success) {
      setDeleteDialog({ open: false });
      const remainingSheets = await fetchSheets(tableId!);
      setSheets(remainingSheets);
      if (activeSheetId === deleteDialog.sheet.id) {
          setActiveSheetId(remainingSheets.length > 0 ? remainingSheets[0].id : null);
      }
    }
  };
  
  // Placeholder for a potential duplicate function
  const handleSheetDuplicate = async (sheet: BetterSheet) => {
      toast.info(`Duplicate functionality for "${sheet.name}" is not yet implemented.`);
  };

  if (!initialLoadComplete) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!table) {
    return (
      <div className="flex items-center justify-center h-screen text-center">
        <div>
          <h2 className="text-lg font-semibold">Table Not Found</h2>
          <Button onClick={() => navigate(`/project/${projectId}`)}><ArrowLeft className="h-4 w-4 mr-2" />Back to Project</Button>
        </div>
      </div>
    );
  }

  return (
    <ProjectLayout
  projectId={projectId!}
  currentTableId={tableId}
  onCreateTable={() => navigate(`/project/${projectId}`)} 
>
      <div className={cn("flex flex-col bg-white h-full", isFullscreen && "fixed inset-0 z-50")}>
        <ExcelToolbar />
        <div className="flex-1 flex flex-col overflow-hidden">
          {sheets.length === 0 ? (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold">This table has no sheets</h3>
                <p className="text-muted-foreground my-2">Get started by creating your first sheet.</p>
                <Button onClick={handleCreateSheet} disabled={isCreatingSheet} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  {isCreatingSheet ? 'Creating...' : 'Create First Sheet'}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-auto bg-gray-50">
                {activeSheetId && (
                  <SheetDetail key={activeSheetId} sheetId={activeSheetId} isFullscreen={isFullscreen} />
                )}
              </div>
              <div className="flex-shrink-0 border-t bg-white">
                <ExcelSheetTabs 
                    sheets={sheets} 
                    activeSheetId={activeSheetId} 
                    onSheetSelect={setActiveSheetId} 
                    onSheetCreate={handleCreateSheet} 
                    onSheetRename={handleSheetRename} 
                    onSheetDelete={handleSheetDelete} 
                    onSheetDuplicate={handleSheetDuplicate} 
                    isCreatingSheet={isCreatingSheet} 
                />
              </div>
            </>
          )}
        </div>

        <DeleteConfirmationDialog 
            open={deleteDialog.open} 
            onOpenChange={(open) => setDeleteDialog({ open, sheet: deleteDialog.sheet })} 
            onConfirm={confirmDeleteSheet} 
            title="Delete Sheet" 
            description="Are you sure? This will permanently delete the sheet and all its data." 
            itemName={deleteDialog.sheet?.name} 
        />
        {table && <TableSettingsModal open={showTableSettings} onOpenChange={setShowTableSettings} table={table} onTableUpdated={loadData} />}
      </div>
    </ProjectLayout>
  );
}

export function ExcelTableDetail() {
  return (
    <FullscreenProvider>
      <ExcelTableDetailInner />
    </FullscreenProvider>
  );
}