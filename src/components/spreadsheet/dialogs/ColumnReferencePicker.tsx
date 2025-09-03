import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Search, CheckCircle } from 'lucide-react';
import { useSheetRepo } from '@/features/sheets/services/SheetRepo';
import { BetterTable, Column } from '@/lib/supabase';
import { useParams } from 'react-router-dom';

// Define the shape of the data we'll work with inside the component
interface TableWithColumns extends BetterTable {
  columns: Column[];
}

interface ColumnReferencePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onColumnSelect: (selectedColumn: { id: string; name: string; table_name: string }) => void;
  selectedColumnId?: string;
  // The ID of the table the current column is in, to prevent self-referencing
  currentTableId?: string; 
}

export function ColumnReferencePicker({
  open,
  onOpenChange,
  onColumnSelect,
  selectedColumnId,
  currentTableId,
}: ColumnReferencePickerProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const { fetchTables, fetchSheets, fetchColumns } = useSheetRepo();

  const [data, setData] = useState<TableWithColumns[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Fetch data only when the dialog is opened
    if (open && projectId) {
      const loadAllTablesAndColumns = async () => {
        setIsLoading(true);
        try {
          // 1. Fetch all tables in the project
          const allTables = await fetchTables(projectId);

          // 2. For each table, fetch its sheets and then its columns
          const tablesWithColumns = await Promise.all(
            allTables
              .filter(table => table.id !== currentTableId) // Exclude the current table
              .map(async (table) => {
                // For simplicity, we'll get columns from the first sheet.
                // A more advanced implementation might aggregate columns from all sheets.
                const sheets = await fetchSheets(table.id);
                if (!sheets || sheets.length === 0) {
                  return { ...table, columns: [] };
                }
                const columns = await fetchColumns(sheets[0].id);
                return { ...table, columns };
              })
          );

          // 3. Filter out any tables that had no columns and set the state
          setData(tablesWithColumns.filter(t => t.columns.length > 0));
        } catch (error) {
          console.error("Failed to load data for Column Reference Picker", error);
        } finally {
          setIsLoading(false);
        }
      };

      loadAllTablesAndColumns();
    }
  }, [open, projectId, currentTableId, fetchTables, fetchSheets, fetchColumns]);

  // Filter the data based on the search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const lowercasedFilter = searchTerm.toLowerCase();

    return data.map(table => ({
      ...table,
      columns: table.columns.filter(column => 
        column.name.toLowerCase().includes(lowercasedFilter)
      ),
    })).filter(table => table.columns.length > 0); // Keep table if it still has matching columns
  }, [data, searchTerm]);

  const handleSelect = (column: Column, table: TableWithColumns) => {
    onColumnSelect({
      id: column.id,
      name: column.name,
      table_name: table.name,
    });
    onOpenChange(false); // Close the dialog after selection
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px] flex flex-col max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select a Reference Column</DialogTitle>
          <DialogDescription>
            Choose a column from another table to use as a reference for automation rules.
          </DialogDescription>
        </DialogHeader>
        
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                placeholder="Search for a column..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
            />
        </div>

        <ScrollArea className="flex-1">
          <div className="pr-4">
            {isLoading ? (
              <p className="text-center text-muted-foreground p-8">Loading tables...</p>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {filteredData.map(table => (
                  <AccordionItem value={table.id} key={table.id}>
                    <AccordionTrigger>{table.name}</AccordionTrigger>
                    <AccordionContent>
                      <div className="flex flex-col gap-1 pl-4">
                        {table.columns.map(column => (
                          <button
                            key={column.id}
                            onClick={() => handleSelect(column, table)}
                            className="flex items-center justify-between text-left p-2 rounded-md hover:bg-accent w-full"
                          >
                            <span>{column.name}</span>
                            {selectedColumnId === column.id && (
                                <CheckCircle className="h-4 w-4 text-primary" />
                            )}
                          </button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
            {!isLoading && filteredData.length === 0 && (
                <p className="text-center text-muted-foreground p-8">
                    {searchTerm ? "No matching columns found." : "No other tables with columns to reference."}
                </p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
