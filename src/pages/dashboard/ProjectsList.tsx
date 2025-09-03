import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
// --- UPGRADE #1: Import an icon for the saving spinner ---
import { Trash2, Plus, FolderOpen, Edit, Save, X, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DeleteConfirmationDialog } from '@/components/shared/dialogs/DeleteConfirmationDialog';
import { useProjects } from '@/hooks/data/useProjects';
import { Project } from '@/lib/supabase';
import { format } from 'date-fns';
import { toast } from 'sonner';

export function ProjectsList() {
  const { fetchProjects, createProject, updateProject, deleteProject } = useProjects();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; project?: Project }>({ open: false });
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ name: string; description: string }>({ name: '', description: '' });
  const [isCreating, setIsCreating] = useState(false);
  // --- UPGRADE #2: Add state for search and saving status ---
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const projectsData = await fetchProjects();
      setProjects(projectsData);
    } catch (error) {
      toast.error("Failed to load projects.");
    } finally {
      setIsLoading(false);
    }
  }, [fetchProjects]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreateProject = async () => {
    if (isCreating) return;
    setIsCreating(true);
    setEditingProject(null);
    try {
      const newProject = await createProject('New Project', 'A brief description.');
      if (newProject) {
        await loadProjects();
        toast.success(`Project "${newProject.name}" created!`);
        setEditingProject(newProject.id);
        setEditValues({ name: newProject.name, description: newProject.description || '' });
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteDialog.project) return;
    const success = await deleteProject(deleteDialog.project.id);
    if (success) {
      setDeleteDialog({ open: false });
      await loadProjects();
    }
  };

  const saveProjectEdit = async (projectId: string) => {
    if (!editValues.name.trim()) {
      toast.error('Project name cannot be empty.');
      return;
    }
    setIsSaving(projectId); // Set saving state
    try {
      const success = await updateProject(projectId, {
        name: editValues.name.trim(),
        description: editValues.description.trim() || null,
      });
      if (success) {
        setEditingProject(null);
        await loadProjects();
      }
    } finally {
      setIsSaving(null); // Clear saving state
    }
  };

  // --- UPGRADE #3: Add keyboard shortcuts for editing ---
  const handleEditKeyDown = (e: React.KeyboardEvent, projectId: string) => {
    if (e.key === 'Enter' && !e.shiftKey) { // Allow Shift+Enter in textarea
      e.preventDefault();
      saveProjectEdit(projectId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingProject(null);
    }
  };

  const startEditingProject = (e: React.MouseEvent, project: Project) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingProject(project.id);
    setEditValues({ name: project.name, description: project.description || '' });
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingProject(null);
  };

  const openDeleteDialog = (e: React.MouseEvent, project: Project) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteDialog({ open: true, project });
  };

  // --- UPGRADE #4: Filter projects based on search term ---
  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (project.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="text-center py-16">
        <Loader2 className="animate-spin h-8 w-8 text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading Projects...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Your Projects</h1>
          <p className="text-muted-foreground">Your centralized hubs for project information.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
             <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input 
                placeholder="Search projects..." 
                className="w-48 pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
          </div>
          <Button onClick={handleCreateProject} disabled={isCreating}>
            <Plus className="h-4 w-4 mr-2" />
            {isCreating ? 'Creating...' : 'New Project'}
          </Button>
        </div>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">Create your first project to get started.</p>
            <Button onClick={handleCreateProject} disabled={isCreating}>
              <Plus className="h-4 w-4 mr-2" />
              {isCreating ? 'Creating...' : 'Create First Project'}
            </Button>
          </CardContent>
        </Card>
      ) : filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Projects Found</h3>
            <p className="text-sm text-muted-foreground text-center">Your search for "{searchTerm}" did not match any projects.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <Link 
              to={`/project/${project.id}`} 
              key={project.id} 
              className="group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg"
              onClick={(e) => { if (editingProject === project.id) e.preventDefault(); }}
            >
              <Card className="hover:shadow-lg transition-shadow h-full flex flex-col">
                <CardHeader>
                  {editingProject === project.id ? (
                    <div className="space-y-2">
                      <Input 
                        value={editValues.name}
                        onChange={(e) => setEditValues({...editValues, name: e.target.value})}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onKeyDown={(e) => handleEditKeyDown(e, project.id)}
                        autoFocus
                        className="text-lg font-semibold"
                      />
                      <Textarea
                        value={editValues.description}
                        onChange={(e) => setEditValues({...editValues, description: e.target.value})}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onKeyDown={(e) => handleEditKeyDown(e, project.id)}
                        rows={2}
                        className="text-sm"
                        placeholder="Project description..."
                      />
                    </div>
                  ) : (
                    <>
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      <CardDescription>{project.description || 'No description'}</CardDescription>
                    </>
                  )}
                </CardHeader>
                {/* --- UPGRADE #5: Cleaner card layout with mt-auto on footer --- */}
                <CardFooter className="mt-auto flex justify-between items-center text-xs text-muted-foreground">
                  <span>Updated: {format(new Date(project.updated_at || project.created_at), 'MMM d, yyyy')}</span>
                  <div className="flex items-center gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    {editingProject === project.id ? (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.preventDefault(); e.stopPropagation(); saveProjectEdit(project.id); }}>
                          {isSaving === project.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4 text-green-600" />
                          )}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cancelEdit}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => startEditingProject(e, project)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => openDeleteDialog(e, project)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <DeleteConfirmationDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, project: deleteDialog.project })}
        onConfirm={handleDeleteProject}
        title="Delete Project"
        description="Are you sure you want to delete this project? This will permanently delete all associated tables, sheets, and data."
        itemName={deleteDialog.project?.name}
      />
    </div>
  );
}