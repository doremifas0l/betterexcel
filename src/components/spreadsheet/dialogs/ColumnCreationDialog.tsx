import React, { useCallback } from 'react'; // <-- Import useCallback
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Column } from '@/lib/supabase';

import { useColumnForm } from '@/features/sheets/hooks/useColumnForm';
import { BasicInfoCard } from './column-creation/BasicInfoCard';
import { ColumnTypeCard } from './column-creation/ColumnTypeCard';
import { SelectOptionsConfig } from './column-creation/SelectOptionsConfig';
import { BetterTable } from '@/lib/supabase'; 

interface ColumnCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheetId: string;
  onColumnCreated: () => void;
  editingColumn?: Column | null;
  availableTables?: BetterTable[];
}

export function ColumnCreationDialog({
  open,
  onOpenChange,
  sheetId,
  onColumnCreated,
  editingColumn = null,
  availableTables
}: ColumnCreationDialogProps) {

  // ✨ THE FIX: Create a stable onSuccess callback using useCallback.
  const handleSuccess = useCallback(() => {
    onColumnCreated();
    onOpenChange(false); // This now comes from a stable function reference
  }, [onColumnCreated, onOpenChange]);


  const {
    loading,
    formData,
    loadExistingData,
    resetForm,
    handleFormChange,
    addSelectOption,
    removeSelectOption,
    updateSelectOption,
    handleSubmit,
  } = useColumnForm({
    sheetId,
    editingColumn,
    onSuccess: handleSuccess, // <-- Pass the stable function to the hook
  });

  React.useEffect(() => {
    if (open) {
      if (editingColumn) {
        loadExistingData();
      } else {
        resetForm();
      }
    }
  }, [open, editingColumn, loadExistingData, resetForm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{editingColumn ? 'Edit Column' : 'Create New Column'}</DialogTitle>
          <DialogDescription>
            Configure the properties for your column.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 space-y-4 py-4">
          <BasicInfoCard
            name={formData.name}
            isRequired={formData.is_required}
            isUnique={formData.is_unique}
            onFormChange={handleFormChange}
          />

          <ColumnTypeCard
            dataType={formData.data_type}
            onDataTypeChange={(newType) => handleFormChange('data_type', newType)}
          />

          {formData.data_type === 'select' && (
            <SelectOptionsConfig
              options={formData.selectOptions}
              onAddOption={addSelectOption}
              onRemoveOption={removeSelectOption}
              onOptionChange={updateSelectOption}
            />
          )}
        </div>
        
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : (editingColumn ? 'Update Column' : 'Create Column')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}