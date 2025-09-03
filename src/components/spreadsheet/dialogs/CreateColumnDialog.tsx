import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Database, Plus } from 'lucide-react';
import { toast } from 'sonner';

// --- CHANGE #1: Import the new, focused hooks ---
import { useColumns } from '@/features/sheets/hooks/useColumns';
import { useSheets } from '@/features/sheets/hooks/useSheets';
import { BetterSheet, BetterTable } from '@/lib/supabase'; // It's good practice to import types

interface CreateColumnDialogProps {
  tableId: string;
  sheetId?: string;
  onColumnCreated?: (column: { id: string; name: string; data_type: string }) => void;
  children?: React.ReactNode;
  availableTables?: BetterTable[]; // <-- Add this line
}

const COLUMN_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'True/False' },
  { value: 'date', label: 'Date' },
  { value: 'email', label: 'Email' },
  { value: 'url', label: 'URL' },
  { value: 'select', label: 'Select' },
  { value: 'multi_select', label: 'Multi-Select' }
];

export function CreateColumnDialog({ tableId, sheetId, onColumnCreated, children }: CreateColumnDialogProps) {
  // --- CHANGE #2: Initialize the new hooks ---
  const { createColumn } = useColumns();
  const { fetchSheets } = useSheets();

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sheets, setSheets] = useState<BetterSheet[]>([]);
  
  // Form state
  const [columnName, setColumnName] = useState('');
  const [columnType, setColumnType] = useState('text');
  const [targetSheetId, setTargetSheetId] = useState(sheetId || '');
  const [isRequired, setIsRequired] = useState(false);
  const [isUnique, setIsUnique] = useState(false);
  const [defaultValue, setDefaultValue] = useState('');

  useEffect(() => {
    const loadSheets = async () => {
      // Only load sheets if we don't have a specific sheetId (i.e., we need the dropdown)
      if (open && tableId && !sheetId) {
        try {
          const sheetsData = await fetchSheets(tableId);
          setSheets(sheetsData);
          
          if (!targetSheetId && sheetsData.length > 0) {
            setTargetSheetId(sheetsData[0].id);
          }
        } catch (error) {
          console.error('Error loading sheets:', error);
          toast.error('Failed to load sheets');
        }
      }
    };
    loadSheets();
  }, [open, tableId, sheetId, fetchSheets]); // Dependencies are correct

  const handleCreate = async () => {
    if (!columnName.trim()) {
      toast.error('Column name is required');
      return;
    }
    if (!targetSheetId) {
      toast.error('Please select a sheet');
      return;
    }

    setCreating(true);
    try {
      const column = await createColumn({
        sheet_id: targetSheetId,
        name: columnName.trim(),
        data_type: columnType,
        is_required: isRequired,
        is_unique: isUnique,
        default_value: defaultValue.trim() || undefined
      });
      
      if (column) {
        toast.success(`Column "${column.name}" created successfully!`);
        onColumnCreated?.(column);
        setOpen(false); // Close dialog on success
        // Form is reset via onOpenChange handler
      }
    } catch (error) {
      // The hook itself will show a toast on error
      console.error('Error creating column:', error);
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setColumnName('');
    setColumnType('text');
    setIsRequired(false);
    setIsUnique(false);
    setDefaultValue('');
    // Only reset the target sheet if it wasn't provided as a prop
    if (!sheetId) {
      setTargetSheetId(sheets.length > 0 ? sheets[0].id : '');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Database className="h-4 w-4 mr-2" />
            Add New Column
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Add New Column
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="column-name">Column Name *</Label>
            <Input
              id="column-name"
              placeholder="e.g., Name, Email, Status"
              value={columnName}
              onChange={(e) => setColumnName(e.target.value)}
            />
          </div>
          
          {!sheetId && (
            <div className="space-y-2">
              <Label htmlFor="target-sheet">Target Sheet *</Label>
              <Select value={targetSheetId} onValueChange={setTargetSheetId}>
                <SelectTrigger id="target-sheet">
                  <SelectValue placeholder="Select a sheet" />
                </SelectTrigger>
                <SelectContent>
                  {sheets.map(sheet => (
                    <SelectItem key={sheet.id} value={sheet.id}>
                      {sheet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="column-type">Data Type</Label>
            <Select value={columnType} onValueChange={setColumnType}>
              <SelectTrigger id="column-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLUMN_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-3 pt-2">
            <div className="flex items-center space-x-2">
              <Checkbox id="is-required" checked={isRequired} onCheckedChange={(checked) => setIsRequired(!!checked)} />
              <Label htmlFor="is-required" className="text-sm font-normal">Required field</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox id="is-unique" checked={isUnique} onCheckedChange={(checked) => setIsUnique(!!checked)} />
              <Label htmlFor="is-unique" className="text-sm font-normal">Unique values only</Label>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="default-value">Default Value (optional)</Label>
            <Input
              id="default-value"
              placeholder="Value for new entries"
              value={defaultValue}
              onChange={(e) => setDefaultValue(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!columnName.trim() || !targetSheetId || creating}>
            {creating ? 'Creating...' : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add Column
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}