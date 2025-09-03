import { useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, Project } from '@/lib/supabase';
import { toast } from 'sonner';
import { nanoid } from 'nanoid';
import { deleteTableAndContents } from '@/services/dbTableService';

/**
 * A stateless utility hook that provides memoized functions for interacting with Projects.
 * It does not hold any state itself. Its functions fetch data and RETURN it.
 */
export function useProjects() {
  const { user } = useAuth();

  /**
   * Fetches projects and returns them.
   */
  const fetchProjects = useCallback(async (): Promise<Project[]> => {
    if (!user) return [];
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`*, project_members!inner(role)`)
        .eq('project_members.user_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const projectsWithRoles = (data || []).map(project => ({
        ...project,
        userRole: project.project_members?.[0]?.role || 'viewer'
      }));
      
      return projectsWithRoles;
    } catch (err: any) {
      console.error('Error fetching projects:', err);
      toast.error('Failed to fetch projects');
      return [];
    }
  }, [user]);

  /**
   * Creates a project and returns the new project.
   */
  const createProject = useCallback(async (name: string, description?: string): Promise<Project | null> => {
    if (!user) return null;
    try {
      let finalName = name;
      if (name === 'New Project' || name.includes('New Project (')) {
        finalName = `New Project ${nanoid(6)}`;
      }
      const { data, error } = await supabase
        .from('projects')
        .insert([{ name: finalName, description, user_id: user.id, created_by: user.id, updated_by: user.id }])
        .select()
        .single();
      if (error) throw error;
      if (data) {
        await supabase.from('project_members').insert([{ user_id: user.id, project_id: data.id, role: 'owner', invited_by: user.id }]);
        await supabase.from('audit_logs').insert([{ project_id: data.id, user_id: user.id, action_type: 'create', target_type: 'project', target_id: data.id, details: { name: finalName, description } }]);
      }
      return data;
    } catch (error: any)
    {
      console.error('Error creating project:', error);
      if (error.code === '23505') {
        toast.error('A project with this name already exists.');
      } else {
        toast.error('Failed to create project.');
      }
      return null;
    }
  }, [user]);

  /**
   * [FIX] Updates a project and returns a boolean indicating success.
   * This is the full, stateless implementation.
   */
  const updateProject = useCallback(async (projectId: string, updates: Partial<Project>): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase
      .from('projects')
      .update({ ...updates, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq('id', projectId);
    
    if (error) {
      console.error('Error updating project:', error);
      toast.error('Failed to update project');
      return false;
    }
    // Note: We do NOT call fetchProjects here. The calling component is responsible for refreshing.
    return true;
  }, [user]);

  /**
   * [FIX] Deletes a project and returns a boolean indicating success.
   * This is the full, stateless implementation.
   */
  const deleteProject = useCallback(async (projectId: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const { data: tables } = await supabase.from('better_tables').select('id').eq('project_id', projectId);
      for (const table of tables || []) {
        // Assuming deleteTableAndContents is an external service function
        await deleteTableAndContents(table.id);
      }

      await supabase.from('projects').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', projectId);
      await supabase.from('trash').insert([{ item_type: 'project', item_id: projectId, user_id: user.id }]);
      
      // Note: We do NOT call fetchProjects here. The calling component is responsible for refreshing.
      return true;
    } catch (error: any) {
      console.error('Error deleting project:', error);
      toast.error(error.message || 'Failed to delete project');
      return false;
    }
  }, [user]);

  // Memoize the return object to prevent infinite loops.
  const memoizedAPI = useMemo(() => ({
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
  }), [fetchProjects, createProject, updateProject, deleteProject]);

  return memoizedAPI;
}