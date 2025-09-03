import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useSheetRepo } from '@/features/sheets/services/SheetRepo';
import { Column } from '@/lib/supabase';

export interface ColumnFormData {
  name: string;
  data_type: string;
  is_required: boolean;
  is_unique: boolean;
  selectOptions: { value: string; label: string }[];
}

interface UseColumnFormProps {
  sheetId: string;
  editingColumn: Column | null;
  onSuccess: () => void;
}

export function useColumnForm({ sheetId, editingColumn, onSuccess }: UseColumnFormProps) {
  const repo = useSheetRepo();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<ColumnFormData>({
    name: '',
    data_type: 'text',
    is_required: false,
    is_unique: false,
    selectOptions: [{ value: '', label: '' }],
  });
  
  // This ref pattern is good, let's keep it
  const formDataRef = useRef(formData);
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);


  const loadExistingData = useCallback(async () => {
    if (!editingColumn) return;
    setLoading(true);
    let selectOptions = [{ value: '', label: '' }];
    if (editingColumn.data_type === 'select') {
      const options = await repo.fetchSelectOptions(editingColumn.id);
      if (options.length > 0) {
        selectOptions = options.map(opt => ({ value: opt.option_value, label: opt.option_label || opt.option_value }));
      }
    }
    setFormData({
      name: editingColumn.name,
      data_type: editingColumn.data_type,
      is_required: !!editingColumn.is_required,
      is_unique: !!editingColumn.is_unique,
      selectOptions: selectOptions,
    });
    setLoading(false);
  }, [editingColumn, repo]);

  const resetForm = useCallback(() => {
    setFormData({ name: '', data_type: 'text', is_required: false, is_unique: false, selectOptions: [{ value: '', label: '' }] });
  }, []);

  const handleFormChange = useCallback((field: keyof ColumnFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const addSelectOption = useCallback(() => {
    setFormData(prev => ({ ...prev, selectOptions: [...prev.selectOptions, { value: '', label: '' }] }));
  }, []);

  const removeSelectOption = useCallback((index: number) => {
    setFormData(prev => ({ ...prev, selectOptions: prev.selectOptions.filter((_, i) => i !== index) }));
  }, []);

  const updateSelectOption = useCallback((index: number, field: 'value' | 'label', value: string) => {
    setFormData(prev => ({
      ...prev,
      selectOptions: prev.selectOptions.map((option, i) => i === index ? { ...option, [field]: value } : option),
    }));
  }, []);

  // --- THE FIX IS IN THIS FUNCTION ---
  const handleSubmit = useCallback(async () => {
    const currentFormData = formDataRef.current;
    if (!currentFormData.name.trim()) {
      toast.error('Column name is required');
      return;
    }

    setLoading(true);
    try {
      const columnPayload = {
        sheet_id: sheetId,
        name: currentFormData.name,
        data_type: currentFormData.data_type,
        is_required: currentFormData.is_required,
        is_unique: currentFormData.is_unique,
      };

      let column;
      if (editingColumn) {
        await repo.updateColumn(editingColumn.id, columnPayload);
        column = { id: editingColumn.id }; // Set a placeholder object for select options logic
      } else {
        column = await repo.createColumn(columnPayload);
        // The repo function will throw an error if it fails, which the catch block will handle.
      }
      
      // ✨ THE FIX: We only proceed if the column was successfully created or updated.
      if (column) {
        if (currentFormData.data_type === 'select') {
          const validOptions = currentFormData.selectOptions.filter(opt => opt.value && opt.label);
          await repo.createSelectOptions(column.id, validOptions);
        }

        toast.success(editingColumn ? 'Column updated!' : 'Column created!');
        onSuccess(); // This will now be called correctly, closing the dialog.
      }

    } catch (error: any) {
      // The repo will show its own toast, but we can log here too.
      console.error("Submit error:", error);
      // We don't call onSuccess() here, so the dialog stays open for the user to fix.
    } finally {
      setLoading(false);
    }
  }, [editingColumn, sheetId, repo, onSuccess]);

  return {
    loading,
    formData,
    loadExistingData,
    resetForm,
    handleFormChange,
    addSelectOption,
    removeSelectOption,
    updateSelectOption,
    handleSubmit,
  };
}

