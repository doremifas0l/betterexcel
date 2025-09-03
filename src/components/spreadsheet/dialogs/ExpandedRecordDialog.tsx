import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Column, Row } from '@/lib/supabase'; // Assuming types are in supabase lib

interface ExpandedRecordDialogProps {
  open: boolean;
  onClose: () => void;
  record: Row | null;
  columns: Column[];
}

export function ExpandedRecordDialog({ open, onClose, record, columns }: ExpandedRecordDialogProps) {
  if (!record) {
    return null;
  }

  // Find the primary column to use as a title (e.g., the first text column)
  const primaryColumn = columns.find(c => c.data_type === 'text');
  const title = primaryColumn && record.row_data?.[primaryColumn.id] 
    ? String(record.row_data[primaryColumn.id]) 
    : "Record Detail";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            View and edit all fields for this record.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-2 py-4 space-y-4">
          {columns.map(col => (
            <div key={col.id} className="grid grid-cols-3 gap-4 items-start">
              <strong className="text-sm font-medium text-gray-500 text-right py-2">{col.name}</strong>
              <div className="col-span-2 p-2 border rounded-md bg-gray-50 min-h-[40px]">
                {/* This is where you would render a proper form input later */}
                {String(record.row_data?.[col.id] ?? '')}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
