import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { ICellEditorParams, ICellEditor } from 'ag-grid-community';
import { Button } from '@/components/ui/button';
import { Search, Plus, X, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
// --- CHANGE #1: Import the new, focused hook for linked records ---
import { useLinkedRecords } from '@/hooks/features/useLinkedRecords';

interface LinkCellEditorProps extends ICellEditorParams {
  linkConfig: {
    target_table_id: string;
    display_column_id?: string;
  };
}

export const LinkCellEditor = forwardRef<ICellEditor, LinkCellEditorProps>((props, ref) => {
  const { value, linkConfig } = props;

  // --- CHANGE #2: Initialize the new hook ---
  const { 
    fetchLinkableRecords, 
    createLinkedRecord, 
    resolveLinkValue, 
    fetchTargetTableColumns 
  } = useLinkedRecords();

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [options, setOptions] = useState<{ id: string; display_value: string }[]>([]);
  const [filteredOptions, setFilteredOptions] = useState<{ id: string; display_value: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value || '');
  const [displayValue, setDisplayValue] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRecordName, setNewRecordName] = useState('');
  const [availableColumns, setAvailableColumns] = useState<{ id: string; name: string }[]>([]);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    getValue: () => selectedValue,
    isPopup: () => true,
    isCancelBeforeStart: () => false,
    isCancelAfterEnd: () => false,
  }));

  useEffect(() => {
    loadOptions();
    loadAvailableColumns();
    if (value) {
      loadDisplayValue(value);
    }
    setIsOpen(true);
  }, []);

  useEffect(() => {
    const filtered = options.filter(option =>
      option.display_value.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredOptions(filtered);
  }, [searchTerm, options]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        props.api.stopEditing(); // Properly stop editing on outside click
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, props.api]);

  const loadOptions = async () => {
    setLoading(true);
    try {
      const records = await fetchLinkableRecords(linkConfig.target_table_id, linkConfig.display_column_id);
      setOptions(records);
    } catch (error) {
      console.error('Error loading link options:', error);
      toast.error('Failed to load link options');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableColumns = async () => {
    try {
      const columns = await fetchTargetTableColumns(linkConfig.target_table_id);
      setAvailableColumns(columns);
    } catch (error) {
      console.error('Error loading target table columns:', error);
    }
  };

  const loadDisplayValue = async (rowId: string) => {
    try {
      const displayVal = await resolveLinkValue(rowId, linkConfig.display_column_id);
      setDisplayValue(displayVal === null ? '#REF (Broken)' : displayVal);
    } catch (error) {
      setDisplayValue('#REF (Error)');
    }
  };

  const handleSelectOption = (optionId: string) => {
    setSelectedValue(optionId);
    props.api.stopEditing();
  };

  const handleCreateNew = async () => {
    if (!newRecordName.trim()) {
      toast.error('Please enter a name for the new record');
      return;
    }
    setLoading(true);
    try {
      const newRecord = await createLinkedRecord(linkConfig.target_table_id, { name: newRecordName.trim() });
      if (newRecord) {
        setOptions(prev => [...prev, newRecord]);
        setSelectedValue(newRecord.id);
        props.api.stopEditing();
        toast.success('New record created and linked');
      }
    } catch (error) {
      console.error('Error creating new record:', error);
      toast.error('Failed to create new record');
    } finally {
      setLoading(false);
    }
  };

  const clearLink = () => {
    setSelectedValue('');
    props.api.stopEditing();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div ref={dropdownRef} className="ag-custom-component-popup absolute z-50 w-80 bg-white border border-gray-300 rounded-lg shadow-lg mt-1">
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search records..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 h-8"
            autoFocus
          />
        </div>
      </div>

      <div className="max-h-60 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-sm text-gray-500">Loading...</div>
        ) : filteredOptions.length > 0 ? (
          filteredOptions.map((option) => (
            <div
              key={option.id}
              className="px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer"
              onClick={() => handleSelectOption(option.id)}
            >
              {option.display_value}
            </div>
          ))
        ) : (
          <div className="p-4 text-center text-sm text-gray-500">No records found.</div>
        )}
      </div>

      <div className="border-t p-2">
        {showCreateForm ? (
          <div className="flex items-center gap-2">
            <Input
              placeholder="Enter new record name"
              value={newRecordName}
              onChange={(e) => setNewRecordName(e.target.value)}
              className="h-8"
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateNew(); }}
            />
            <Button size="sm" onClick={handleCreateNew} className="h-8">Create</Button>
            <Button size="icon" variant="ghost" onClick={() => setShowCreateForm(false)} className="h-8 w-8">
                <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4" />
            Create new record
          </Button>
        )}
      </div>
    </div>
  );
});

LinkCellEditor.displayName = 'LinkCellEditor';