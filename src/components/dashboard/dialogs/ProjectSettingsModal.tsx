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
import { Project } from '@/lib/supabase';
import { toast } from 'sonner';

// --- CHANGE #1: Import the new, focused hook ---
import { useProjects } from '@/hooks/data/useProjects';

interface ProjectSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  onProjectUpdated: () => void;
}

export function ProjectSettingsModal({
  open,
  onOpenChange,
  project,
  onProjectUpdated,
}: ProjectSettingsModalProps) {
  // --- CHANGE #2: Initialize the new hook ---
  const { updateProject } = useProjects();

  // --- CHANGE #3: Manage the loading state locally ---
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: project.name,
    description: project.description || '',
  });

  // Reset form state if the project prop changes while the dialog is open
  useEffect(() => {
    if (open) {
      setFormData({
        name: project.name,
        description: project.description || '',
      });
    }
  }, [project, open]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Project name is required');
      return;
    }

    setIsSaving(true);
    try {
      const success = await updateProject(project.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
      });

      if (success) {
        onProjectUpdated();
        onOpenChange(false);
        toast.success('Project settings updated successfully!');
      }
    } catch (error) {
      // The hook itself will likely show a toast on error
      console.error('Error updating project:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Project Settings</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Enter project name"
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
              placeholder="Enter project description"
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