import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Table2, Hash, Type, Calendar, Mail, ToggleLeft, Calculator, Crown, Key, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- CHANGE #1: Import the new, focused hooks ---
import { useTables } from '@/hooks/data/useTables';
import { useSheets } from '@/features/sheets/hooks/useSheets';
import { useColumns } from '@/features/sheets/hooks/useColumns';

interface EnhancedTableCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onTableCreated: () => void;
}

interface ColumnDefinition {
  name: string;
  dataType: string;
  isRequired: boolean;
  isUnique: boolean;
  isPrimary: boolean;
}

const COLUMN_TYPES = [
  { value: 'text', label: 'Text', icon: Type },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'checkbox', label: 'Checkbox', icon: ToggleLeft },
  { value: 'select', label: 'Select', icon: Calculator },
];

export function EnhancedTableCreationDialog({
  open,
  onOpenChange,
  projectId,
  onTableCreated
}: EnhancedTableCreationDialogProps) {
  // --- CHANGE #2: Initialize the new hooks ---
  const { createTable, updateTable } = useTables();
  const { createSheet } = useSheets();
  const { createColumn } = useColumns();
  
  const [tableName, setTableName] = useState('');
  const [tableDescription, setTableDescription] = useState('');
  const [columns, setColumns] = useState<ColumnDefinition[]>([
    { name: 'Name', dataType: 'text', isRequired: true, isUnique: false, isPrimary: true },
    { name: 'Created At', dataType: 'date', isRequired: false, isUnique: false, isPrimary: false }
  ]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (open) {
      // Reset form when dialog opens
      setTableName('');
      setTableDescription('');
      setColumns([
        { name: 'Name', dataType: 'text', isRequired: true, isUnique: false, isPrimary: true },
        { name: 'Created At', dataType: 'date', isRequired: false, isUnique: false, isPrimary: false }
      ]);
    }
  }, [open]);

  const addColumn = () => {
    setColumns(prev => [...prev, { name: '', dataType: 'text', isRequired: false, isUnique: false, isPrimary: false }]);
  };

  const removeColumn = (index: number) => {
    if (columns.length <= 1) {
      toast.error('Table must have at least one column');
      return;
    }
    setColumns(prev => prev.filter((_, i) => i !== index));
  };

  const updateColumn = (index: number, field: keyof ColumnDefinition, value: any) => {
      setColumns(prev => {
          let newColumns = prev.map((col, i) => i === index ? { ...col, [field]: value } : col);
          // If setting a column as primary, unset all others.
          if (field === 'isPrimary' && value === true) {
              newColumns = newColumns.map((col, i) => i === index ? col : { ...col, isPrimary: false });
          }
          return newColumns;
      });
  };

  const setPrimaryColumn = (index: number) => {
    setColumns(prev => prev.map((col, i) => ({ ...col, isPrimary: i === index })));
  };

  const validateForm = () => {
    // ... (Validation logic remains the same) ...
    if (!tableName.trim()) {
        toast.error('Table name is required');
        return false;
    }
    const validColumns = columns.filter(col => col.name.trim());
    if (validColumns.length === 0) {
        toast.error('At least one column is required');
        return false;
    }
    if (!validColumns.some(col => col.isPrimary)) {
        toast.error('Please select a primary column');
        return false;
    }
    const columnNames = validColumns.map(col => col.name.trim().toLowerCase());
    if (new Set(columnNames).size !== columnNames.length) {
        toast.error('Column names must be unique');
        return false;
    }
    return true;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    setIsCreating(true);
    try {
      // --- CHANGE #3: Use the new stateless functions ---
      const table = await createTable({ projectId, name: tableName.trim(), description: tableDescription.trim() });
      if (!table) throw new Error("Table creation failed.");

      const sheet = await createSheet({ tableId: table.id, name: 'Main', description: 'Main data sheet' });
      if (!sheet) throw new Error("Default sheet creation failed.");

      const validColumns = columns.filter(col => col.name.trim());
      let primaryColumnId: string | null = null;

      for (const column of validColumns) {
        const createdColumn = await createColumn({
          sheet_id: sheet.id,
          name: column.name.trim(),
          data_type: column.dataType,
          is_required: column.isRequired,
          is_unique: column.isUnique,
        });
        
        if (!createdColumn) throw new Error(`Failed to create column: ${column.name}`);
        if (column.isPrimary) {
          primaryColumnId = createdColumn.id;
        }
      }

      if (primaryColumnId) {
        // Update the table with the ID of its primary column
        await updateTable(table.id, { primary_column_id: primaryColumnId });
      }

      toast.success(`Table "${tableName}" created successfully!`);
      onTableCreated();
      onOpenChange(false);
      
    } catch (error) {
      console.error('Error creating table:', error);
      toast.error(`Failed to create table: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCreating(false);
    }
  };

  const getColumnIcon = (dataType: string) => {
    const type = COLUMN_TYPES.find(t => t.value === dataType);
    return type ? type.icon : Type;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <Table2 className="h-5 w-5" />
                Create New Table
            </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
            {/* Table Basic Info */}
            <div className="space-y-4">
                <div className="grid gap-2">
                    <Label htmlFor="tableName">Table Name *</Label>
                    <Input id="tableName" value={tableName} onChange={(e) => setTableName(e.target.value)} placeholder="e.g. Students, Products, Tasks" />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="tableDescription">Description</Label>
                    <Textarea id="tableDescription" value={tableDescription} onChange={(e) => setTableDescription(e.target.value)} placeholder="Describe what this table will contain" rows={2} />
                </div>
            </div>

            {/* Columns Configuration */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Columns</Label>
                    <Button onClick={addColumn} variant="outline" size="sm">Add Column</Button>
                </div>
            
                <div className="space-y-3">
                    {columns.map((column, index) => {
                        const IconComponent = getColumnIcon(column.dataType);
                        return (
                            <Card key={index} className={cn("transition-colors", column.isPrimary ? 'ring-2 ring-yellow-300 bg-yellow-50/50' : '')}>
                                <CardHeader className="pb-4">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                                            <IconComponent className="h-4 w-4 text-muted-foreground" />
                                            <span>Column {index + 1}</span>
                                            {column.isPrimary && <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Crown className="h-3 w-3 mr-1" />Primary</Badge>}
                                            {column.isUnique && <Badge variant="outline"><Key className="h-3 w-3 mr-1" />Unique</Badge>}
                                        </CardTitle>
                                        {columns.length > 1 && <Button onClick={() => removeColumn(index)} variant="ghost" size="sm" className="text-destructive hover:text-destructive">Remove</Button>}
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2"><Label>Name</Label><Input value={column.name} onChange={(e) => updateColumn(index, 'name', e.target.value)} placeholder="Column name" /></div>
                                        <div className="space-y-2"><Label>Type</Label>
                                            <Select value={column.dataType} onValueChange={(value) => updateColumn(index, 'dataType', value)}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {COLUMN_TYPES.map(type => (
                                                        <SelectItem key={type.value} value={type.value}><div className="flex items-center gap-2"><type.icon className="h-4 w-4" />{type.label}</div></SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-4">
                                        <div className="flex items-start space-x-3 p-3 rounded-lg border flex-1 hover:bg-gray-50/50">
                                            <Checkbox id={`primary-${index}`} checked={column.isPrimary} onCheckedChange={(checked) => checked && setPrimaryColumn(index)} />
                                            <div className="space-y-1"><Label htmlFor={`primary-${index}`} className="font-medium cursor-pointer">Primary Column</Label><p className="text-xs text-muted-foreground">Main identifier for each row.</p></div>
                                        </div>
                                        <div className="flex items-start space-x-3 p-3 rounded-lg border flex-1 hover:bg-gray-50/50">
                                            <Checkbox id={`unique-${index}`} checked={column.isUnique} onCheckedChange={(checked) => updateColumn(index, 'isUnique', !!checked)} />
                                            <div className="space-y-1"><Label htmlFor={`unique-${index}`} className="font-medium cursor-pointer">Unique Values</Label><p className="text-xs text-muted-foreground">Prevent duplicate values.</p></div>
                                        </div>
                                        <div className="flex items-start space-x-3 p-3 rounded-lg border flex-1 hover:bg-gray-50/50">
                                            <Checkbox id={`required-${index}`} checked={column.isRequired} onCheckedChange={(checked) => updateColumn(index, 'isRequired', !!checked)} />
                                            <div className="space-y-1"><Label htmlFor={`required-${index}`} className="font-medium cursor-pointer">Required Field</Label><p className="text-xs text-muted-foreground">This field must have a value.</p></div>
                                        </div>
                                    </div>
                                    {column.isPrimary && !column.isUnique && (
                                        <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                                            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                            <p>Primary columns should typically have unique values. Consider enabling the "Unique Values" option.</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? 'Creating...' : 'Create Table'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}