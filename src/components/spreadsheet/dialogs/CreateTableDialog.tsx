import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table2, Plus } from 'lucide-react';
import { toast } from 'sonner';

// --- CHANGE #1: Import the new, focused hook ---
import { useTables } from '@/hooks/data/useTables';

interface CreateTableDialogProps {
  projectId: string;
  onTableCreated?: (table: { id: string; name: string }) => void;
  children?: React.ReactNode;
}

export function CreateTableDialog({ projectId, onTableCreated, children }: CreateTableDialogProps) {
  // --- CHANGE #2: Initialize the new hook ---
  const { createTable } = useTables();

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tableName, setTableName] = useState('');
  const [tableDescription, setTableDescription] = useState('');

  const handleCreate = async () => {
    if (!tableName.trim()) {
      toast.error('Table name is required');
      return;
    }

    setCreating(true);
    try {
      // --- CHANGE #3: Call the new function with an object payload ---
      const table = await createTable({
        projectId: projectId,
        name: tableName.trim(),
        description: tableDescription.trim() || undefined,
      });

      if (table) {
        toast.success(`Table "${table.name}" created successfully!`);
        onTableCreated?.(table);
        setOpen(false);
        // Form is reset via the onOpenChange handler
      }
    } catch (error) {
      // The hook will show its own error toast
      console.error('Error creating table:', error);
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setTableName('');
    setTableDescription('');
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Table2 className="h-4 w-4 mr-2" />
            Create New Table
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Table2 className="h-5 w-5" />
            Create New Table
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="table-name">Table Name *</Label>
            <Input
              id="table-name"
              placeholder="e.g., Students, Products, Orders"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && tableName.trim()) {
                  handleCreate();
                }
              }}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="table-description">Description (optional)</Label>
            <Textarea
              id="table-description"
              placeholder="Describe what this table will store..."
              value={tableDescription}
              onChange={(e) => setTableDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!tableName.trim() || creating}>
            {creating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create Table
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}