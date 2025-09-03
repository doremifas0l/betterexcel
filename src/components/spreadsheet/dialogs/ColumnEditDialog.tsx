import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription, // ✨ For the confirmation dialog
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { ColumnReferencePicker } from './ColumnReferencePicker';
import { DataConversionPreview } from '@/components/ui/DataConversionPreview';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { useColumns } from '@/features/sheets/hooks/useColumns';
import { useAutomatedColumns } from '@/hooks/features/useAutomatedColumns';
import { Column } from '@/lib/supabase'; // Assuming you have a Column type defined

interface ColumnEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  column?: Column | null; // Allow column to be null
  onColumnUpdated: () => void;
  onColumnDeleted: () => void; // ✨ 1. Add a callback for when deletion is successful
}

interface AutomationRule {
  rule_type: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'greater_equal' | 'less_equal';
  condition_value: string;
  result_value: string;
  rule_order: number;
  strict_mode: boolean;
}

export function ColumnEditDialog({
  open,
  onOpenChange,
  column,
  onColumnUpdated,
  onColumnDeleted, // ✨ Destructure the new prop
}: ColumnEditDialogProps) {
  // ✨ 2. Add `deleteColumn` from your hook
  const { updateColumn, deleteColumn, getColumnSampleData } = useColumns(); 
  const {
    getAutomatedColumnConfig,
    updateAutomatedColumnConfig,
  } = useAutomatedColumns();

  const [name, setName] = useState('');
  const [type, setType] = useState('text');
  const [mode, setMode] = useState<'manual' | 'automatic'>('manual');
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [selectedReferenceColumn, setSelectedReferenceColumn] = useState<any>(null);
  const [defaultValue, setDefaultValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false); // ✨ State for delete operation
  const [showReferencePicker, setShowReferencePicker] = useState(false);
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); // ✨ State for confirmation dialog

  // ... (loadAutomationConfig and loadSampleData remain the same)
  const loadAutomationConfig = useCallback(async () => { /* ... no changes ... */ }, [column, getAutomatedColumnConfig]);
  const loadSampleData = useCallback(async () => { /* ... no changes ... */ }, [column, getColumnSampleData]);


  useEffect(() => {
    if (column && open) {
      setName(column.name);
      setType(column.data_type);
      setMode(column.mode);
      setDefaultValue('');
      setAutomationRules([]);
      setSelectedReferenceColumn(null);
      
      if (column.mode === 'automatic') {
        loadAutomationConfig();
      }
      loadSampleData();
    } else if (!open) {
      // Reset confirmation state when dialog closes
      setShowDeleteConfirm(false);
    }
  }, [column, open, loadAutomationConfig, loadSampleData]);

  // ... (handleSubmit remains the same)
  const handleSubmit = async (e: React.FormEvent) => { /* ... no changes ... */ };

  // ✨ 3. Implement the delete handler
  const handleDelete = async () => {
    if (!column) return;

    setIsDeleting(true);
    try {
      await deleteColumn(column.id);
      toast.success(`Column "${column.name}" deleted successfully.`);
      onColumnDeleted(); // Notify parent
      onOpenChange(false); // Close the main dialog
    } catch (error: any) {
      console.error('Error deleting column:', error);
      toast.error(error.message || 'Failed to delete column.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false); // Close confirmation dialog
    }
  };
  
  const handleCancel = () => {
    // ... same as before
    onOpenChange(false);
  };
  
  // ... (addRule, updateRule, removeRule, handleReferenceColumnSelect remain the same)
  const addRule = () => { /* ... */ };
  const updateRule = (index: number, updates: Partial<AutomationRule>) => { /* ... */ };
  const removeRule = (index: number) => { /* ... */ };
  const handleReferenceColumnSelect = (selectedColumn: any) => { /* ... */ };


  return (
    <>
      <Dialog open={open && !showDeleteConfirm} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Column: {column?.name || 'Unknown'}</DialogTitle>
          </DialogHeader>

          {/* The entire form remains the same */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 space-y-6">
            {/* ... all your form fields for name, type, mode, rules etc. ... */}
          </form>

          <DialogFooter className="pt-6 sticky bottom-0 bg-white py-4 -mx-6 px-6 border-t justify-between">
            {/* ✨ 4. Add the Delete button to the footer */}
            <div>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isLoading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Column
              </Button>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleCancel} disabled={isLoading}>Cancel</Button>
              <Button form="column-edit-form" type="submit" disabled={isLoading}>
                {isLoading ? 'Updating...' : 'Update Column'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* ✨ 5. Add the nested confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you absolutely sure?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the 
              <strong> {column?.name}</strong> column and all of its data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Yes, Delete Column'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ColumnReferencePicker remains the same */}
      <ColumnReferencePicker
        open={showReferencePicker}
        onOpenChange={setShowReferencePicker}
        // ... other props
      />
    </>
  );
}
