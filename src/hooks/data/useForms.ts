import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

/**
 * Interface representing the structure of a single form,
 * directly matching the 'forms' table schema.
 */
export interface Form {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  settings?: any; // JSONB can be typed more strictly if its structure is known
  field_config?: any[]; // JSONB
  is_active?: boolean | null;
  created_at: string;
  updated_at?: string | null;
  is_deleted?: boolean | null;
  project_id: string; // Assuming it's always tied to a project in this context
  form_type?: string | null;
  processing_mode?: string | null;
  success_message?: string | null;
  failure_message?: string | null;
  unique_columns?: any[]; // JSONB
  closed_message?: string | null;
  passcode?: string | null;
  close_date?: string | null;
  table_name?: string | null;
  use_staging: boolean;
}

/**
 * Interface for the data required to create a new form.
 */
export interface CreateFormData {
  name: string;
  description?: string;
  projectId: string;
  successMessage?: string;
  failureMessage?: string;
  questions: any[]; // The shape of questions for the 'forms-create' function
}

/**
 * A comprehensive hook for managing all form-related data operations.
 */
export function useForms() {
  const { user } = useAuth();

  /**
   * Fetches all non-deleted forms for a given project.
   */
  const fetchForms = useCallback(async (projectId: string): Promise<Form[]> => {
    if (!projectId || !user) return [];
    
    try {
      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading forms:', error);
      toast.error('Failed to load forms');
      return [];
    }
  }, [user]);

  /**
   * Fetches a single form's complete data, likely including its questions,
   * by calling the 'forms-get' edge function.
   */
  const getForm = async (formId: string): Promise<any | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('forms-get', {
        body: { form_id: formId }
      });
      if (error) throw error;
      return data?.data || null; // The edge function wraps the result in a 'data' property
    } catch (error) {
      console.error('Error loading form:', error);
      toast.error('Failed to load form data');
      return null;
    }
  };

  /**
   * Creates a new form by calling the 'forms-create' edge function.
   */
  const createForm = async (formData: CreateFormData): Promise<Form | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('forms-create', {
        body: {
          name: formData.name,
          description: formData.description,
          project_id: formData.projectId,
          success_message: formData.successMessage,
          failure_message: formData.failureMessage,
          questions: formData.questions.map(q => ({ ...q, id: undefined })),
          settings: { theme: 'default', show_progress: true }
        }
      });

      if (error) throw error;
      
      if (data?.data?.form) {
        toast.success(`Form "${formData.name}" created successfully!`);
        return data.data.form;
      }
      return null;
    } catch (error) {
      console.error('Error saving form:', error);
      toast.error('Failed to save form');
      return null;
    }
  };

  /**
   * Soft-deletes a form by setting its 'is_deleted' flag to true.
   */
  const deleteForm = async (formId: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const { error } = await supabase
        .from('forms')
        .update({ is_deleted: true })
        .eq('id', formId);

      if (error) throw error;

      toast.success('Form deleted successfully');
      return true;
    } catch (error) {
      console.error('Error deleting form:', error);
      toast.error('Failed to delete form');
      return false;
    }
  };

  /**
   * Duplicates an existing form by fetching it and then creating a new one with its data.
   */
  const duplicateForm = async (form: Form): Promise<boolean> => {
    try {
      const originalForm = await getForm(form.id);

      if (originalForm) {
        const { error: createError } = await supabase.functions.invoke('forms-create', {
          body: {
            name: `${originalForm.name} (Copy)`,
            description: originalForm.description,
            project_id: form.project_id,
            success_message: originalForm.success_message,
            failure_message: originalForm.failure_message,
            questions: originalForm.questions?.map((q: any) => ({ ...q, id: undefined })) || [],
            settings: originalForm.settings
          }
        });

        if (createError) throw createError;
        toast.success('Form duplicated successfully');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error duplicating form:', error);
      toast.error('Failed to duplicate form');
      return false;
    }
  };

  return { fetchForms, getForm, createForm, deleteForm, duplicateForm };
}