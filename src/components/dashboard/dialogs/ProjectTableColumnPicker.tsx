import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronRight, Search, Table, Columns, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- FINAL FIX: Using relative paths to bypass the '@' alias system ---
import { useProjects } from '../../../hooks/data/useProjects';
import { useTables } from '../../../hooks/data/useTables';
import { useSheets } from '../../../features/sheets/hooks/useSheets';
import { useColumns } from '../../../features/sheets/hooks/useColumns';


// Interfaces for local state remain the same
interface ColumnInfo {
  id: string;
  name: string;
  data_type: string;
  table_id: string;
  sheet_id: string;
}
interface TableInfo {
  id: string;
  name: string;
  description?: string;
  project_id: string;
  project_name: string;
  columns: ColumnInfo[];
}
interface ProjectGroup {
  id: string;
  name: string;
  tables: TableInfo[];
}
interface ProjectTableColumnPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectionComplete: (selection: {
    projectId: string;
    projectName: string;
    tableId: string;
    tableName: string;
    columnId: string;
    columnName: string;
    columnDataType?: string;
    sheetId: string;
  }) => void;
  currentProjectId?: string;
  title?: string;
}

export function ProjectTableColumnPicker({
  open,
  onOpenChange,
  onSelectionComplete,
  currentProjectId,
  title = 'Select Target Column'
}: ProjectTableColumnPickerProps) {
  const { fetchProjects } = useProjects();
  const { fetchTables } = useTables();
  const { fetchSheets } = useSheets();
  const { fetchColumns } = useColumns();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
  const [loading, setLoading] = useState(false);

  const loadProjectsTablesAndColumns = useCallback(async () => {
    setLoading(true);
    try {
      const projects = await fetchProjects();
      
      const projectGroupsData: ProjectGroup[] = await Promise.all(
        projects.map(async (project) => {
          const tables = await fetchTables(project.id);
          
          const projectTables: TableInfo[] = await Promise.all(
            tables.map(async (table) => {
              const sheets = await fetchSheets(table.id);
              if (sheets.length === 0) return null;
              
              const mainSheet = sheets[0];
              const tableColumns = await fetchColumns(mainSheet.id);

              return {
                id: table.id,
                name: table.name,
                description: table.description,
                project_id: project.id,
                project_name: project.name,
                columns: tableColumns.map(col => ({
                  id: col.id,
                  name: col.name,
                  data_type: col.data_type,
                  table_id: table.id,
                  sheet_id: mainSheet.id
                }))
              };
            })
          );
          
          return {
            id: project.id,
            name: project.name,
            tables: projectTables.filter((t): t is TableInfo => t !== null)
          };
        })
      );
      
      setProjectGroups(projectGroupsData);
      
      if (currentProjectId) {
        setExpandedProjects(new Set([currentProjectId]));
      } else if (projectGroupsData.length === 1) {
        setExpandedProjects(new Set([projectGroupsData[0].id]));
      }
    } catch (error) {
      console.error('Error loading project hierarchy:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchProjects, fetchTables, fetchSheets, fetchColumns, currentProjectId]);

  useEffect(() => {
    if (open) {
      loadProjectsTablesAndColumns();
    }
  }, [open, loadProjectsTablesAndColumns]);


  const filteredProjectGroups = projectGroups
    .map((project) => ({
      ...project,
      tables: project.tables.filter(
        (table) =>
          table.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          table.columns.some(col => col.name.toLowerCase().includes(searchQuery.toLowerCase()))
      ).map(table => ({
        ...table,
        columns: table.columns.filter(
          col => 
            col.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            table.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            project.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })),
    }))
    .filter((project) => project.tables.length > 0 || searchQuery === '');
  
  const toggleProjectExpansion = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) newExpanded.delete(projectId);
    else newExpanded.add(projectId);
    setExpandedProjects(newExpanded);
  };

  const toggleTableExpansion = (tableId: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableId)) newExpanded.delete(tableId);
    else newExpanded.add(tableId);
    setExpandedTables(newExpanded);
  };

  const handleColumnSelect = (project: ProjectGroup, table: TableInfo, column: ColumnInfo) => {
    onSelectionComplete({
      projectId: project.id,
      projectName: project.name,
      tableId: table.id,
      tableName: table.name,
      columnId: column.id,
      columnName: column.name,
      columnDataType: column.data_type,
      sheetId: column.sheet_id
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[700px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search projects, tables and columns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex-1 overflow-y-auto border rounded-md p-2">
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">Loading hierarchy...</div>
          ) : filteredProjectGroups.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">{searchQuery ? 'No results found' : 'No projects available'}</div>
          ) : (
            filteredProjectGroups.map((project) => (
              <div key={project.id} className="mb-1">
                <div className={cn('flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-accent', project.id === currentProjectId && 'bg-blue-50')} onClick={() => toggleProjectExpansion(project.id)}>
                  {expandedProjects.has(project.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <FolderOpen className="h-4 w-4" />
                  <span className="font-medium">{project.name}</span>
                </div>
                {expandedProjects.has(project.id) && (
                  <div className="ml-6 mt-1 space-y-1">
                    {project.tables.map((table) => (
                      <div key={table.id}>
                        <div className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-accent" onClick={() => toggleTableExpansion(table.id)}>
                          {table.columns.length > 0 && (expandedTables.has(table.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                          <Table className="h-4 w-4" />
                          <span>{table.name}</span>
                        </div>
                        {expandedTables.has(table.id) && (
                          <div className="ml-6 mt-1 space-y-1">
                            {table.columns.map((column) => (
                              <div key={column.id} className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-accent" onClick={() => handleColumnSelect(project, table, column)}>
                                <Columns className="h-4 w-4" />
                                <span>{column.name}</span>
                                <span className="text-xs text-muted-foreground capitalize">{column.data_type}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}