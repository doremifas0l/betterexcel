import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { BetterTable } from '@/lib/supabase';
import { toast } from 'sonner';

// --- CHANGE #1: Import the new, focused hook ---
import { useTables } from '@/hooks/data/useTables';

interface TableSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: BetterTable;
  onTableUpdated: () => void;
}

export function TableSettingsModal({
  open,
  onOpenChange,
  table,
  onTableUpdated,
}: TableSettingsModalProps) {
  // --- CHANGE #2: Initialize the new hook ---
  const { updateTable } = useTables();

  // --- CHANGE #3: Manage the loading state locally ---
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: table.name,
    description: table.description || '',
  });

  // Reset form state if the table prop changes while the dialog is open
  useEffect(() => {
    if (open) {
      setFormData({
        name: table.name,
        description: table.description || '',
      });
    }
  }, [table, open]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Table name is required');
      return;
    }

    setIsSaving(true);
    try {
      const success = await updateTable(table.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
      });

      if (success) {
        onTableUpdated();
        onOpenChange(false);
        // The hook already shows a success toast, so this one is optional
        // toast.success('Table settings updated successfully!');
      }
    } catch (error) {
      // The hook will show its own error toast
      console.error('Error updating table:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Table Settings</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Table Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Enter table name"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Enter table description"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}