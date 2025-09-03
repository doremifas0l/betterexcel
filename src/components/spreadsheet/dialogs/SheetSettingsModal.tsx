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
import { BetterSheet } from '@/lib/supabase';
import { toast } from 'sonner';

// --- CHANGE #1: Import the new, focused hook ---
import { useSheets } from '@/features/sheets/hooks/useSheets';

interface SheetSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheet: BetterSheet;
  onSheetUpdated: () => void;
}

export function SheetSettingsModal({
  open,
  onOpenChange,
  sheet,
  onSheetUpdated,
}: SheetSettingsModalProps) {
  // --- CHANGE #2: Initialize the new hook ---
  const { updateSheet } = useSheets();

  // --- CHANGE #3: Manage the loading state locally ---
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: sheet.name,
    description: sheet.description || '',
  });

  // Reset form state if the sheet prop changes while the dialog is open
  useEffect(() => {
    if (open) {
      setFormData({
        name: sheet.name,
        description: sheet.description || '',
      });
    }
  }, [sheet, open]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Sheet name is required');
      return;
    }

    setIsSaving(true);
    try {
      const success = await updateSheet(sheet.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
      });

      if (success) {
        onSheetUpdated();
        onOpenChange(false);
        // The hook already shows a success toast
      }
    } catch (error) {
      // The hook will show its own error toast
      console.error('Error updating sheet:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Sheet Settings</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Sheet Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Enter sheet name"
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
              placeholder="Enter sheet description"
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