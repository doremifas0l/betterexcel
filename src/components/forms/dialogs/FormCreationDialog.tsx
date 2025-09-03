import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { FormCreator } from '../FormCreator';

interface FormCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onFormCreated: () => void; // This will be used to refresh the list of forms
}

export function FormCreationDialog({ open, onOpenChange, projectId, onFormCreated }: FormCreationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-2xl">Create a New Form</DialogTitle>
          <DialogDescription>
            Configure the form settings and add questions. Questions can be mapped to database columns across any project.
          </DialogDescription>
        </DialogHeader>
        {/* Make the content area scrollable */}
        <div className="flex-grow overflow-y-auto px-6 pb-6">
          <FormCreator
            projectId={projectId}
            onSave={() => {
              // When the form is saved successfully...
              onFormCreated(); // ...refresh the list in the parent component...
              onOpenChange(false); // ...and close the dialog.
            }}
            onCancel={() => onOpenChange(false)} // Simply close the dialog on cancel
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}