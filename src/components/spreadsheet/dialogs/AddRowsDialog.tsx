import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';

// Define the properties (props) the component will accept
interface AddRowsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (numberOfRows: number) => void;
}

export function AddRowsDialog({ open, onOpenChange, onConfirm }: AddRowsDialogProps) {
  // This state is now local to the dialog component
  const [numRows, setNumRows] = useState(1);

  const handleConfirmClick = () => {
    if (numRows < 1 || numRows > 100) {
      toast.error("Please enter a number between 1 and 100.");
      return;
    }
    // Use the callback to pass the final number back to the parent
    onConfirm(numRows);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Add New Rows</AlertDialogTitle>
          <AlertDialogDescription>
            How many new rows would you like to add to the sheet?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="num-rows" className="text-right">
              Rows
            </Label>
            <Input
              id="num-rows"
              type="number"
              value={numRows}
              onChange={(e) => setNumRows(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="col-span-3"
              min="1"
              max="100" // A reasonable limit
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setNumRows(1)}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmClick}>Add Rows</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}