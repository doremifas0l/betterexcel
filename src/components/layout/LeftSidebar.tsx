import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search, Table2, Plus, Hash, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BetterTable } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { TableContextMenu } from '@/components/dashboard/TableContextMenu';
import { TableRenameDialog } from '@/components/spreadsheet/dialogs/TableRenameDialog';
import { TableDuplicateDialog } from '@/components/spreadsheet/dialogs/TableDuplicateDialog';
import { PrimaryColumnDialog } from '@/components/spreadsheet/dialogs/PrimaryColumnDialog';
import { DeleteConfirmationDialog } from '@/components/shared/dialogs/DeleteConfirmationDialog';

// --- CHANGE #1: Import the new, focused hook ---
import { useTables } from '@/hooks/data/useTables';

interface LeftSidebarProps {
  projectId: string;
  currentTableId?: string;
  isCollapsed: boolean;
  onToggle: () => void;
  onCreateTable: () => void;
  refreshTrigger?: number;
}

export function LeftSidebar({
  projectId,
  currentTableId,
  isCollapsed,
  onToggle,
  onCreateTable,
  refreshTrigger
}: LeftSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // --- CHANGE #2: Initialize the new hook ---
  // Note: We are assuming `duplicateTable` is a function provided by your useTables hook.
  const { fetchTables, updateTable, deleteTable, duplicateTable } = useTables();

  const [tables, setTables] = useState<BetterTable[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // --- CHANGE #3: Manage action-specific loading state locally ---
  const [isDeleting, setIsDeleting] = useState(false);

  // Dialog states
  const [selectedTable, setSelectedTable] = useState<BetterTable | null>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPrimaryDialog, setShowPrimaryDialog] = useState(false);
  
  const isFormsPage = location.pathname.includes('/forms');

  useEffect(() => {
    if (projectId) {
      loadTables();
    }
  }, [projectId, refreshTrigger]);

  const loadTables = async () => {
    setIsLoading(true);
    try {
      const data = await fetchTables(projectId);
      setTables(data);
    } finally {
      setIsLoading(false);
    }
  };

  // Context menu handlers
  const handleRename = (table: BetterTable) => {
    setSelectedTable(table);
    setShowRenameDialog(true);
  };

  const handleDuplicate = (table: BetterTable) => {
    setSelectedTable(table);
    setShowDuplicateDialog(true);
  };

  const handleDelete = (table: BetterTable) => {
    setSelectedTable(table);
    setShowDeleteDialog(true);
  };

  const handleSetPrimary = (table: BetterTable) => {
    setSelectedTable(table);
    setShowPrimaryDialog(true);
  };

  // Dialog actions
  const performRename = async (tableId: string, name: string, description?: string) => {
    const success = await updateTable(tableId, { name, description });
    if (success) loadTables();
    return success;
  };

  const performDuplicate = async (tableId: string, newName: string, description?: string, copyData?: boolean) => {
    // Assuming `duplicateTable` exists on `useTables`
    const newTable = await duplicateTable?.(tableId, newName, description, copyData); 
    if (newTable) {
      loadTables();
      navigate(`/project/${projectId}/table/${newTable.id}`);
    }
    return !!newTable;
  };

  const performDelete = async () => {
    if (!selectedTable) return false;
    
    setIsDeleting(true); // Use local loading state
    let success = false;
    try {
      success = await deleteTable(selectedTable.id);
      if (success) {
        loadTables();
        if (currentTableId === selectedTable.id) {
          navigate(`/project/${projectId}`);
        }
      }
    } finally {
      setIsDeleting(false); // Stop loading
    }
    return success;
  };

  const filteredTables = tables.filter(table =>
    table.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleTableClick = (tableId: string) => {
    navigate(`/project/${projectId}/table/${tableId}`);
  };
  
  const handleFormsClick = () => {
    navigate(`/project/${projectId}/forms`);
  };

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const key = e.key;
        const index = parseInt(key) - 1;
        if (index >= 0 && index < filteredTables.length) {
          e.preventDefault();
          handleTableClick(filteredTables[index].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [filteredTables, projectId]);

  if (isCollapsed) {
    // Return collapsed JSX...
    return (
        <div className="w-12 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-2">
                <Button variant="ghost" size="icon" onClick={onToggle} className="w-8 h-8">
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
            <div className="flex-1 flex flex-col items-center space-y-2 p-2">
                {filteredTables.slice(0, 8).map((table, index) => (
                    <Button
                      key={table.id}
                      variant="ghost"
                      size="icon"
                      onClick={() => handleTableClick(table.id)}
                      className={cn("w-8 h-8 text-xs font-medium", currentTableId === table.id ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "hover:bg-gray-100")}
                      title={`${table.name} (Ctrl+${index + 1})`}
                    >
                      {index + 1}
                    </Button>
                ))}
                <Button variant="ghost" size="icon" onClick={onCreateTable} className="w-8 h-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100" title="Create New Table">
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
  }

  // Return full-width JSX...
  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">Navigation</h3>
                <Button variant="ghost" size="icon" onClick={onToggle} className="w-8 h-8">
                    <ChevronLeft className="h-4 w-4" />
                </Button>
            </div>
            {/* ... other header elements like search ... */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search tables..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-8"
                />
            </div>
        </div>

        {/* Tables List */}
        <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
                <div className="p-4 text-center text-gray-500">Loading...</div>
            ) : filteredTables.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                    <p>No tables found.</p>
                    <Button onClick={onCreateTable} size="sm" className="mt-2">
                        <Plus className="h-4 w-4 mr-1" />
                        Create Table
                    </Button>
                </div>
            ) : (
                filteredTables.map((table, index) => (
                    <TableContextMenu
                      key={table.id}
                      table={table}
                      onRename={handleRename}
                      onDuplicate={handleDuplicate}
                      onDelete={handleDelete}
                      onSetPrimary={handleSetPrimary}
                    >
                        <div
                          className={cn("group flex items-center justify-between p-2 rounded-md cursor-pointer mb-1", currentTableId === table.id ? "bg-blue-100 text-blue-900" : "hover:bg-gray-100 text-gray-700")}
                          onClick={() => handleTableClick(table.id)}
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-mono bg-gray-200 text-gray-600 rounded px-1.5 py-0.5">{index + 1}</span>
                                <span className="font-medium truncate">{table.name}</span>
                                {table.primary_column_id && <Crown className="h-3 w-3 text-yellow-600 flex-shrink-0" />}
                            </div>
                        </div>
                    </TableContextMenu>
                ))
            )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200">
            <Button onClick={onCreateTable} className="w-full" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                New Table
            </Button>
        </div>
        
        {/* Dialogs */}
        <TableRenameDialog open={showRenameDialog} onOpenChange={setShowRenameDialog} table={selectedTable} onRename={performRename} />
        <TableDuplicateDialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog} table={selectedTable} onDuplicate={performDuplicate} />
        <DeleteConfirmationDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          onConfirm={performDelete}
          title="Delete Table"
          description="Are you sure? This will permanently delete the table and all its data."
          itemName={selectedTable?.name}
          loading={isDeleting} // Use the new action-specific loading state
        />
        <PrimaryColumnDialog open={showPrimaryDialog} onOpenChange={setShowPrimaryDialog} table={selectedTable} onPrimaryChanged={loadTables} />
    </div>
  );
}