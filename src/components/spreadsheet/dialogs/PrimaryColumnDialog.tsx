import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BetterTable, Column } from '@/lib/supabase';
import { toast } from 'sonner';
import { Crown, Key, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- CHANGE #1: Import the new, focused hooks ---
import { useTables } from '@/hooks/data/useTables';
import { useSheets } from '@/features/sheets/hooks/useSheets';
import { useColumns } from '@/features/sheets/hooks/useColumns';

interface PrimaryColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: BetterTable | null;
  onPrimaryChanged: () => void;
}

export function PrimaryColumnDialog({
  open,
  onOpenChange,
  table,
  onPrimaryChanged
}: PrimaryColumnDialogProps) {
  // --- CHANGE #2: Initialize the new hooks ---
  const { updateTable } = useTables();
  const { fetchSheets } = useSheets();
  const { fetchColumns } = useColumns();

  const [columns, setColumns] = useState<Column[]>([]);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<{ [columnId: string]: boolean }>({});

  useEffect(() => {
    const loadColumns = async () => {
      if (!table) return;
      try {
        const sheets = await fetchSheets(table.id);
        if (sheets.length > 0) {
          const sheetColumns = await fetchColumns(sheets[0].id);
          setColumns(sheetColumns);
          
          // In a real app, you would perform a database check for uniqueness here.
          // For now, we'll assume any column marked as 'is_unique' can be a primary key.
          const status: { [columnId: string]: boolean } = {};
          sheetColumns.forEach(column => {
            status[column.id] = !!column.is_unique;
          });
          setValidationStatus(status);
        }
      } catch (error) {
        console.error('Error loading columns:', error);
        toast.error('Failed to load columns');
      }
    };

    if (table && open) {
      loadColumns();
      setSelectedColumnId(table.primary_column_id || null);
    }
  }, [table, open, fetchSheets, fetchColumns]);

  const handleSetPrimary = async () => {
    if (!table || !selectedColumnId) return;

    setIsUpdating(true);
    try {
      const success = await updateTable(table.id, {
        primary_column_id: selectedColumnId
      });
      
      if (success) {
        onPrimaryChanged();
        onOpenChange(false);
        toast.success('Primary column updated successfully');
      }
    } catch (error) {
      // The hook will show its own toast on error
      console.error('Error setting primary column:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemovePrimary = async () => {
    if (!table) return;

    setIsUpdating(true);
    try {
      const success = await updateTable(table.id, {
        primary_column_id: null
      });
      
      if (success) {
        setSelectedColumnId(null);
        onPrimaryChanged();
        onOpenChange(false);
        toast.success('Primary column removed successfully');
      }
    } catch (error) {
      console.error('Error removing primary column:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-600" />
            Manage Primary Column
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {table && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">Table: {table.name}</h4>
              <p className="text-sm text-blue-800">
                The primary column serves as the main identifier for records in this table. It should contain unique values.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <h4 className="font-medium">Select a Column</h4>
            
            {columns.length === 0 ? (
              <p className="text-center text-muted-foreground p-4">No columns found in this table.</p>
            ) : (
              <div className="grid gap-3">
                {/* No Primary Column Option */}
                <Card 
                  className={cn("cursor-pointer transition-all", selectedColumnId === null ? "ring-2 ring-primary bg-secondary" : "hover:bg-accent")}
                  onClick={() => setSelectedColumnId(null)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div>
                            <div className="font-medium">No Primary Column</div>
                            <div className="text-sm text-muted-foreground">The table will not have a primary identifier.</div>
                        </div>
                    </div>
                    {selectedColumnId === null && <CheckCircle className="h-5 w-5 text-primary" />}
                  </CardContent>
                </Card>
                
                {/* Column Options */}
                {columns.map((column) => {
                  const isSelected = selectedColumnId === column.id;
                  const canBePrimary = validationStatus[column.id];
                  
                  return (
                    <Card 
                      key={column.id}
                      className={cn(
                        "transition-all",
                        isSelected ? "ring-2 ring-primary bg-secondary" : (canBePrimary ? "cursor-pointer hover:bg-accent" : "opacity-50 cursor-not-allowed")
                      )}
                      onClick={() => canBePrimary && setSelectedColumnId(column.id)}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">{column.name}</span>
                                    {table?.primary_column_id === column.id && <Badge variant="secondary">Current</Badge>}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    Type: {column.data_type}
                                    {!canBePrimary && ' • (Does not contain unique values)'}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {!canBePrimary && <AlertCircle className="h-5 w-5 text-amber-500" />}
                            {isSelected && <CheckCircle className="h-5 w-5 text-primary" />}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {table?.primary_column_id && selectedColumnId === null && (
            <Button variant="destructive" onClick={handleRemovePrimary} disabled={isUpdating}>
              {isUpdating ? 'Removing...' : 'Remove Primary'}
            </Button>
          )}
          <Button onClick={handleSetPrimary} disabled={isUpdating || selectedColumnId === table?.primary_column_id || selectedColumnId === null}>
            {isUpdating ? 'Setting...' : 'Set as Primary'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}