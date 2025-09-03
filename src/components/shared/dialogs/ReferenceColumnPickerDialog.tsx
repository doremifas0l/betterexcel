import React, { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { FileStack, Table, Sheet, ChevronsRight } from 'lucide-react'

interface AvailableColumn {
  project_id: string
  project_name: string
  table_id: string
  table_name: string
  sheet_id: string
  sheet_name: string
  column_id: string
  column_name: string
  data_type: string
}

interface ReferenceColumnPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  availableColumns: AvailableColumn[]
  currentSheetId: string
  onColumnSelect: (column: AvailableColumn) => void
}

// Define the new nested data structure
type ProjectMap = Map<string, {
  projectName: string;
  tables: Map<string, {
    tableName: string;
    sheets: Map<string, {
      sheetName: string;
      columns: AvailableColumn[];
    }>;
  }>;
}>;

export function ReferenceColumnPickerDialog({
  open,
  onOpenChange,
  availableColumns,
  currentSheetId,
  onColumnSelect,
}: ReferenceColumnPickerDialogProps) {

  // State to track the user's selection path
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  // Memoized function to transform the flat list into a nested, hierarchical map
  const projectsMap: ProjectMap = useMemo(() => {
    const map: ProjectMap = new Map();
    for (const col of availableColumns) {
      if (!map.has(col.project_id)) {
        map.set(col.project_id, { projectName: col.project_name, tables: new Map() });
      }
      const project = map.get(col.project_id)!;

      if (!project.tables.has(col.table_id)) {
        project.tables.set(col.table_id, { tableName: col.table_name, sheets: new Map() });
      }
      const table = project.tables.get(col.table_id)!;

      if (!table.sheets.has(col.sheet_id)) {
        table.sheets.set(col.sheet_id, { sheetName: col.sheet_name, columns: [] });
      }
      const sheet = table.sheets.get(col.sheet_id)!;
      sheet.columns.push(col);
    }
    return map;
  }, [availableColumns]);

  // Handlers to update the selection state
  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    setSelectedTableId(null); // Reset table selection when project changes
  };

  const handleTableSelect = (tableId: string) => {
    setSelectedTableId(tableId);
  };

  const selectedProjectTables = selectedProjectId ? projectsMap.get(selectedProjectId)?.tables : null;
  const selectedTableSheets = selectedTableId && selectedProjectTables ? selectedProjectTables.get(selectedTableId)?.sheets : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select a Reference Column</DialogTitle>
          <DialogDescription>
            Choose a column to watch. This column's value will be updated based on the value of the reference column.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-3 gap-4 flex-1 overflow-hidden">
          {/* Column 1: Projects */}
          <div className="flex flex-col border-r pr-4">
            <div className="font-semibold text-sm mb-2 flex items-center"><FileStack className="h-4 w-4 mr-2" />Projects</div>
            <ScrollArea>
              <div className="space-y-1">
                {Array.from(projectsMap.entries()).map(([projectId, projectData]) => (
                  <button key={projectId} onClick={() => handleProjectSelect(projectId)} className={cn("w-full text-left p-2 rounded-md transition-colors text-sm flex justify-between items-center", selectedProjectId === projectId ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-100')}>
                    {projectData.projectName}
                    {selectedProjectId === projectId && <ChevronsRight className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Column 2: Tables */}
          <div className="flex flex-col border-r pr-4">
            <div className="font-semibold text-sm mb-2 flex items-center"><Table className="h-4 w-4 mr-2" />Tables</div>
            <ScrollArea>
              {selectedProjectId ? (
                <div className="space-y-1">
                  {selectedProjectTables && Array.from(selectedProjectTables.entries()).map(([tableId, tableData]) => (
                    <button key={tableId} onClick={() => handleTableSelect(tableId)} className={cn("w-full text-left p-2 rounded-md transition-colors text-sm flex justify-between items-center", selectedTableId === tableId ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-100')}>
                      {tableData.tableName}
                      {selectedTableId === tableId && <ChevronsRight className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 h-full flex items-center justify-center">Select a project</div>
              )}
            </ScrollArea>
          </div>

          {/* Column 3: Sheets & Columns */}
          <div className="flex flex-col">
            <div className="font-semibold text-sm mb-2 flex items-center"><Sheet className="h-4 w-4 mr-2" />Sheets & Columns</div>
            <ScrollArea>
              {selectedTableId ? (
                <Accordion type="single" collapsible className="w-full">
                  {selectedTableSheets && Array.from(selectedTableSheets.entries()).map(([sheetId, sheetData]) => {
                    const isCurrentSheet = sheetId === currentSheetId;
                    return (
                      <AccordionItem key={sheetId} value={sheetId}>
                        <AccordionTrigger className="text-sm">
                          <div className="flex items-center justify-between w-full pr-2">
                            {sheetData.sheetName}
                            {isCurrentSheet && <Badge variant="default">Current</Badge>}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-1 pl-2">
                            {sheetData.columns.map(col => (
                              <button
                                key={col.column_id}
                                disabled={!isCurrentSheet}
                                onClick={() => {
                                  if (isCurrentSheet) {
                                    onColumnSelect(col);
                                    onOpenChange(false);
                                  } else {
                                    toast.info("Coming Soon!", { description: "Cross-sheet automation will be available in a future update." });
                                  }
                                }}
                                className={cn("w-full text-left p-2 rounded-md transition-colors text-sm", isCurrentSheet ? "hover:bg-blue-50 cursor-pointer" : "cursor-not-allowed text-gray-400 opacity-70")}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="font-medium">{col.column_name}</span>
                                  <Badge variant="outline" className="font-mono text-xs">{col.data_type}</Badge>
                                </div>
                              </button>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              ) : (
                <div className="text-sm text-gray-500 h-full flex items-center justify-center">Select a table</div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}