import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trash2, Plus, ArrowLeft, FileSpreadsheet, Edit, Save, X, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DeleteConfirmationDialog } from '@/components/shared/dialogs/DeleteConfirmationDialog';
import { TableSettingsModal } from '@/components/spreadsheet/dialogs/TableSettingsModal';
import { Project, BetterTable, BetterSheet } from '@/lib/supabase';
import { format } from 'date-fns';
import { toast } from 'sonner';

// --- CHANGE #1: Import the new, focused hooks ---
import { useProjects } from '@/hooks/data/useProjects';
import { useTables } from '@/hooks/data/useTables';
import { useSheets } from '@/features/sheets/hooks/useSheets';

export function TableDetail() {
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
  
  // --- CHANGE #3: Component now manages its own state ---
  const [project, setProject] = useState<Project | null>(null);
  const [table, setTable] = useState<BetterTable | null>(null);
  const [sheets, setSheets] = useState<BetterSheet[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; sheet?: BetterSheet }>({ open: false });
  const [editingSheet, setEditingSheet] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ name: string; description: string }>({ name: '', description: '' });
  const [showTableSettings, setShowTableSettings] = useState(false);

  // --- Best Practice: Wrap data loading functions in useCallback ---
  const loadProject = useCallback(async () => {
    const projects = await fetchProjects();
    const currentProject = projects.find(p => p.id === projectId);
    setProject(currentProject || null);
  }, [projectId, fetchProjects]);

  const loadTable = useCallback(async () => {
    if (!projectId) return;
    const tables = await fetchTables(projectId);
    const currentTable = tables.find(t => t.id === tableId);
    setTable(currentTable || null);
  }, [projectId, tableId, fetchTables]);

  const loadSheets = useCallback(async () => {
    if (!tableId) return;
    const data = await fetchSheets(tableId);
    setSheets(data);
  }, [tableId, fetchSheets]);

  // --- CHANGE #4: Updated useEffect for robust loading state management ---
  useEffect(() => {
    const loadAllData = async () => {
      if (projectId && tableId) {
        setPageLoading(true);
        try {
          await Promise.all([loadProject(), loadTable(), loadSheets()]);
        } catch (error) {
          console.error("Failed to load table details:", error);
          toast.error("Could not load table details.");
        } finally {
          setPageLoading(false);
        }
      }
    };
    loadAllData();
  }, [projectId, tableId, loadProject, loadTable, loadSheets]);

  const handleCreateSheet = async () => {
    if (!tableId) return;
    
    setIsCreating(true);
    try {
      const sheet = await createSheet({ tableId, name: 'New Sheet', description: 'Created sheet' });
      if (sheet) {
        await loadSheets();
        setEditingSheet(sheet.id);
        setEditValues({ name: sheet.name, description: sheet.description || '' });
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSheet = async () => {
    if (!deleteDialog.sheet) return;
    
    setIsDeleting(true);
    try {
      const success = await deleteSheet(deleteDialog.sheet.id, true);
      if (success) {
        await loadSheets();
        setDeleteDialog({ open: false });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const startEditingSheet = (sheet: BetterSheet) => {
    setEditingSheet(sheet.id);
    setEditValues({ name: sheet.name, description: sheet.description || '' });
  };

  const saveSheetEdit = async (sheetId: string) => {
    if (!editValues.name.trim()) {
      toast.error('Sheet name is required');
      return;
    }

    const success = await updateSheet(sheetId, {
      name: editValues.name.trim(),
      description: editValues.description.trim() || null
    });
    
    if (success) {
      await loadSheets();
      setEditingSheet(null);
    }
  };

  const cancelEdit = () => {
    setEditingSheet(null);
  };

  const openDeleteDialog = (sheet: BetterSheet) => {
    setDeleteDialog({ open: true, sheet });
  };

  if (pageLoading) {
    return <div>Loading table details...</div>;
  }

  if (!project || !table) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Table not found</h2>
          <Button onClick={() => navigate(`/project/${projectId}`)} className="mt-4">
            Back to Project
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/project/${projectId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-1">
              <span>{project.name}</span>
              <span>•</span>
              <span>Table</span>
            </div>
            <h1 className="text-3xl font-bold">{table.name}</h1>
            <p className="text-muted-foreground">
              {table.description || 'No description'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => setShowTableSettings(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Table Settings
          </Button>
          <Button onClick={handleCreateSheet} disabled={isCreating}>
            <Plus className="h-4 w-4 mr-2" />
            {isCreating ? 'Creating...' : 'New Sheet'}
          </Button>
        </div>
      </div>

      {sheets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No sheets yet</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Create your first sheet to start entering data with advanced column types and validation.
            </p>
            <Button onClick={handleCreateSheet} disabled={isCreating}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Sheet
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sheets.map((sheet) => (
            <Card 
              key={sheet.id} 
              className={`hover:shadow-md transition-shadow group ${
                editingSheet === sheet.id ? 'ring-2 ring-primary' : 'cursor-pointer'
              }`}
              onClick={() => editingSheet !== sheet.id && navigate(`/project/${projectId}/table/${tableId}/sheet/${sheet.id}`)}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div className="space-y-1 flex-1">
                  {editingSheet === sheet.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editValues.name}
                        onChange={(e) => setEditValues(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full text-lg font-semibold bg-transparent border-b-2 border-primary focus:outline-none"
                        placeholder="Sheet name"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                      <textarea
                        value={editValues.description}
                        onChange={(e) => setEditValues(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full text-sm bg-transparent border-b border-input focus:outline-none focus:border-primary resize-none"
                        placeholder="Sheet description"
                        rows={2}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  ) : (
                    <>
                      <CardTitle className="text-lg">{sheet.name}</CardTitle>
                      <CardDescription className="text-sm">
                        {sheet.description || 'No description'}
                      </CardDescription>
                    </>
                  )}
                </div>
                
                <div className="flex items-center space-x-1">
                  {editingSheet === sheet.id ? (
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={(e) => { e.stopPropagation(); saveSheetEdit(sheet.id); }}>
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); cancelEdit(); }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); startEditingSheet(sheet); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); openDeleteDialog(sheet); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              
              {editingSheet !== sheet.id && (
                <CardContent>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Created: {format(new Date(sheet.created_at), 'MMM d, yyyy')}</span>
                    <span className="font-semibold text-primary">
                      Open Sheet →
                    </span>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <DeleteConfirmationDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, sheet: deleteDialog.sheet })}
        onConfirm={handleDeleteSheet}
        title="Delete Sheet"
        description="Are you sure you want to delete this sheet? This will permanently delete all columns, rows, and cell data within this sheet."
        itemName={deleteDialog.sheet?.name}
        loading={isDeleting}
      />
      
      {/* Assuming TableSettingsModal is a valid component */}
      {/* <TableSettingsModal
        open={showTableSettings}
        onOpenChange={setShowTableSettings}
        tableId={tableId}
        onTableUpdated={loadTable}
      /> */}
    </div>
  );
}