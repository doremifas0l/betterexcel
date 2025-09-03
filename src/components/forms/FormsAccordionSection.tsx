import React, { useState, useEffect } from 'react';
import { useForms, Form } from '@/hooks/data/useForms';
import { FormCard } from './FormCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, ClipboardList } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import { FormCreationDialog } from './dialogs/FormCreationDialog';

interface FormsAccordionSectionProps {
  projectId: string;
}

export function FormsAccordionSection({ projectId }: FormsAccordionSectionProps) {
  const { fetchForms, deleteForm, duplicateForm } = useForms();
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchForms(projectId);
    setForms(data);
    setLoading(false);
  };

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const handleDelete = async (formId: string) => {
    const success = await deleteForm(formId);
    if (success) loadData();
  };

  const handleDuplicate = async (form: Form) => {
    const success = await duplicateForm(form);
    if (success) loadData();
  };

  const handleShare = (formId: string) => {
    const publicUrl = `${window.location.origin}/public/forms/${formId}`;
    navigator.clipboard.writeText(publicUrl);
    toast.success('Share URL copied to clipboard!');
  };

  const handleManage = (formId: string, formName: string) => {
    toast.info(`Navigating to manage page for "${formName}"`);
  };

  const handleSettings = (formId: string, formName: string) => {
    toast.info(`Opening settings for "${formName}"`);
  };

  return (
    <>
      <AccordionItem value="forms" className="border rounded-lg">
        {/* --- FIX: Create a flexbox wrapper for the header --- */}
        <div className="flex items-center justify-between p-4 pl-6">
          <AccordionTrigger className="flex-1 p-0 text-left hover:no-underline">
            <div className="flex items-center gap-3">
              <ClipboardList className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold">Forms</h2>
              <Badge variant="secondary">{forms.length}</Badge>
            </div>
          </AccordionTrigger>
          {/* --- FIX: The Button is now a SIBLING to the AccordionTrigger --- */}
          <Button
            size="sm"
            className="ml-4"
            onClick={(e) => { e.stopPropagation(); setShowCreateDialog(true); }}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Form
          </Button>
        </div>
        
        <AccordionContent className="p-6 pt-0">
          {loading ? (
            <p className="text-center text-muted-foreground">Loading forms...</p>
          ) : forms.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <h3 className="text-lg font-semibold">No Forms Yet</h3>
              <p className="text-muted-foreground mt-1">Create a form to start collecting data.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {forms.map(form => (
                <FormCard 
                  key={form.id} 
                  form={form}
                  projectId={projectId}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicate}
                  onShare={handleShare}
                  onManage={handleManage}
                  onSettings={handleSettings}
                />
              ))}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>

      <FormCreationDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        projectId={projectId}
        onFormCreated={loadData}
      />
    </>
  );
}