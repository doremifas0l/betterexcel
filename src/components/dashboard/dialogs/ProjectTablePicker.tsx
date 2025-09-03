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

import { useProjects } from '@/hooks/data/useProjects';
import { useTables } from '@/hooks/data/useTables';
import { useSheets } from '@/features/sheets/hooks/useSheets';
import { useColumns } from '@/features/sheets/hooks/useColumns';

interface ColumnInfo {
  id: string;
  name: string;
  data_type: string;
}

interface TableInfo {
  id: string;
  name: string;
  columns: ColumnInfo[];
}

interface ProjectGroup {
  id: string;
  name: string;
  tables: TableInfo[];
}

interface ProjectTablePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // --- FIX: Replaced the placeholder comment with the actual type definition ---
  onSelectionComplete: (selection: {
    projectId: string;
    projectName: string;
    tableId: string;
    tableName: string;
    columnId?: string;
    columnName?: string;
  }) => void;
  selectedTableId?: string;
  selectedColumnId?: string;
  title?: string;
  showColumnSelection?: boolean;
}

export function ProjectTablePicker({
  open,
  onOpenChange,
  onSelectionComplete,
  selectedTableId,
  selectedColumnId,
  title = 'Select an item',
  showColumnSelection = false,
}: ProjectTablePickerProps) {
  const { fetchProjects } = useProjects();
  const { fetchTables } = useTables();
  const { fetchSheets } = useSheets();
  const { fetchColumns } = useColumns();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
  const [loading, setLoading] = useState(false);

  const loadProjectsAndTables = useCallback(async () => {
    setLoading(true);
    try {
      const projects = await fetchProjects();
      
      const projectGroupsData = await Promise.all(
        projects.map(async (project) => {
          const tables = await fetchTables(project.id);
          const tablesWithColumns = await Promise.all(
            tables.map(async (table) => {
              const sheets = await fetchSheets(table.id);
              const columns = sheets.length > 0 ? await fetchColumns(sheets[0].id) : [];
              return {
                id: table.id,
                name: table.name,
                columns: columns.map(c => ({ id: c.id, name: c.name, data_type: c.data_type })),
              };
            })
          );

          return {
            id: project.id,
            name: project.name,
            tables: tablesWithColumns,
          };
        })
      );
      
      setProjectGroups(projectGroupsData);

      if (projectGroupsData.length === 1) {
        setExpandedProjects(new Set([projectGroupsData[0].id]));
      }
    } catch (error) {
      console.error('Error loading projects and tables:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchProjects, fetchTables, fetchSheets, fetchColumns]);

  useEffect(() => {
    if (open) {
      loadProjectsAndTables();
    }
  }, [open, loadProjectsAndTables]);

  const filteredProjectGroups = projectGroups.map((project) => ({
    ...project,
    tables: project.tables.filter(table =>
        table.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.name.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter(project => project.tables.length > 0);

  const toggleProjectExpansion = (projectId: string) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) newSet.delete(projectId);
      else newSet.add(projectId);
      return newSet;
    });
  };

  const toggleTableExpansion = (tableId: string) => {
    setExpandedTables(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tableId)) newSet.delete(tableId);
      else newSet.add(tableId);
      return newSet;
    });
  };

  const handleSelect = (project: ProjectGroup, table: TableInfo, column?: ColumnInfo) => {
    onSelectionComplete({
      projectId: project.id,
      projectName: project.name,
      tableId: table.id,
      tableName: table.name,
      columnId: column?.id,
      columnName: column?.name,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects or tables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-y-auto border rounded-md p-2">
          {loading ? (
            <p className="text-center p-8 text-muted-foreground">Loading...</p>
          ) : filteredProjectGroups.length === 0 ? (
            <p className="text-center p-8 text-muted-foreground">No items found.</p>
          ) : (
            filteredProjectGroups.map((project) => (
              <div key={project.id}>
                <div className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-accent" onClick={() => toggleProjectExpansion(project.id)}>
                  {expandedProjects.has(project.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <FolderOpen className="h-4 w-4" />
                  <span className="font-medium">{project.name}</span>
                </div>
                {expandedProjects.has(project.id) && (
                  <div className="pl-6">
                    {project.tables.map(table => (
                      <div key={table.id}>
                          <div className={cn("flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-accent", selectedTableId === table.id && !showColumnSelection && 'bg-primary/10')} onClick={() => showColumnSelection ? toggleTableExpansion(table.id) : handleSelect(project, table)}>
                              {showColumnSelection && table.columns.length > 0 && (
                                  expandedTables.has(table.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                              )}
                              <Table className="h-4 w-4 ml-2" />
                              <span className="flex-1">{table.name}</span>
                              {!showColumnSelection && <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleSelect(project, table); }}>Select</Button>}
                          </div>
                          {showColumnSelection && expandedTables.has(table.id) && (
                              <div className="pl-8">
                                  {table.columns.map(column => (
                                      <div key={column.id} className={cn("flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-accent", selectedColumnId === column.id && 'bg-primary/10')} onClick={() => handleSelect(project, table, column)}>
                                          <Columns className="h-4 w-4" />
                                          <span>{column.name}</span>
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