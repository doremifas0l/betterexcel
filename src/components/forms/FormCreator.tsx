import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
// --- IMPROVEMENT #2: Added Pencil icon for editing ---
import { Plus, Trash2, Settings, Save, ArrowUp, ArrowDown, Table2, Database, Link2, FolderOpen, AlertTriangle, Pencil } from 'lucide-react';
import { ProjectTableColumnPicker } from '@/components/dashboard/dialogs/ProjectTableColumnPicker';
import { CreateTableDialog } from '@/components/spreadsheet/dialogs/CreateTableDialog';
import { CreateColumnDialog } from '@/components/spreadsheet/dialogs/CreateColumnDialog';
import { EnhancedFormSettings } from '@/components/forms/EnhancedFormSettings';
import { toast } from 'sonner';
import { nanoid } from 'nanoid';

// --- Assumed hook signature from refactor ---
// --- IMPROVEMENT #1: The hook now also provides an `updateForm` function ---
import { useForms } from '@/hooks/data/useForms';

// Interfaces and constants remain the same
interface FormQuestion {
  id: string;
  question_order: number;
  question_label: string;
  question_description?: string;
  help_text?: string;
  is_required: boolean;
  is_visible: boolean;
  question_type: string;
  question_config: any;
  default_value?: string;
  placeholder_text?: string;
  target_project_id?: string;
  target_project_name?: string;
  target_table_id?: string;
  target_table_name?: string;
  target_column_id?: string;
  target_column_name?: string;
  target_column_data_type?: string;
  creates_relationship?: boolean;
  relationship_config?: any;
}

interface FormCreatorProps {
  projectId: string;
  formId?: string;
  onSave?: (formId: string) => void;
  onCancel?: () => void;
}

const QUESTION_TYPES = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  // ... (rest of the types)
];

function validateQuestionColumnTypeCompatibility(questionType: string, columnType: string): {
  compatible: boolean;
  message?: string;
  canConvert?: boolean;
} {
  // ... (implementation remains the same)
  const questionTypeMapping: Record<string, string[]> = {
    'text': ['text', 'varchar', 'char', 'string'], 'textarea': ['text', 'varchar', 'longtext'], 'number': ['number', 'integer', 'bigint', 'decimal', 'float', 'double'], 'email': ['text', 'varchar', 'email'], 'phone': ['text', 'varchar', 'phone'], 'date': ['date', 'timestamp', 'timestamptz'], 'datetime': ['timestamp', 'timestamptz', 'datetime'], 'select': ['text', 'varchar', 'select'], 'radio': ['text', 'varchar', 'select'], 'checkbox': ['text', 'varchar', 'json', 'array'], 'boolean': ['boolean', 'bool']
  };
  const compatibleTypes = questionTypeMapping[questionType] || ['text'];
  const normalizedColumnType = columnType.toLowerCase();
  const isDirectlyCompatible = compatibleTypes.some(type => normalizedColumnType.includes(type.toLowerCase()));
  if (isDirectlyCompatible) { return { compatible: true }; }
  const canConvertToText = ['text', 'varchar', 'char'].includes(normalizedColumnType);
  if (canConvertToText) { return { compatible: true, canConvert: true, message: `Will convert ${questionType} to ${columnType}` }; }
  return { compatible: false, message: `${questionType} questions cannot be stored in ${columnType} columns.` };
}

export function FormCreator({ projectId, formId, onSave, onCancel }: FormCreatorProps) {
  // --- IMPROVEMENT #1 (BUG FIX): Assume `useForms` also provides `updateForm` ---
  const { getForm, createForm, updateForm } = useForms();
  
  const [loading, setLoading] = useState(!!formId);
  const [saving, setSaving] = useState(false);
  
  // --- IMPROVEMENT #3: State to track unsaved changes ---
  const [isDirty, setIsDirty] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [successMessage, setSuccessMessage] = useState('Thank you for your submission!');
  const [failureMessage, setFailureMessage] = useState('Sorry, there was an error with your submission. Please try again.');
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  
  // UI state
  const [showProjectTableDialog, setShowProjectTableDialog] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  // --- IMPROVEMENT #2: State to track which question is being edited ---
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const isEditingQuestion = editingQuestionIndex !== null;

  const [newQuestion, setNewQuestion] = useState<Partial<FormQuestion>>({
    question_label: '', question_type: 'text', is_required: false, is_visible: true, creates_relationship: false
  });

  // --- IMPROVEMENT #3: Effect to detect changes and mark the form as "dirty" ---
  useEffect(() => {
    if (!loading) {
      setIsDirty(true);
    }
  }, [formName, formDescription, successMessage, failureMessage, questions]);

  // --- IMPROVEMENT #3: Effect to warn the user before they leave with unsaved changes ---
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty) {
        event.preventDefault();
        event.returnValue = ''; // Required for cross-browser compatibility
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  useEffect(() => {
    if (formId) {
      loadExistingForm();
    }
  }, [formId]);

  const loadExistingForm = async () => {
    if (!formId) return;
    setLoading(true);
    
    const form = await getForm(formId);

    if (form) {
      setFormName(form.name);
      setFormDescription(form.description || '');
      setSuccessMessage(form.success_message || 'Thank you for your submission!');
      setFailureMessage(form.failure_message || 'Sorry, there was an error. Please try again.');
      setQuestions(form.questions || []);
      // --- IMPROVEMENT #3: After loading, set form to not dirty ---
      setTimeout(() => setIsDirty(false), 100);
    }
    setLoading(false);
  };

  const resetNewQuestion = () => {
    setNewQuestion({ question_label: '', question_type: 'text', is_required: false, is_visible: true, creates_relationship: false });
  };

  const closeMainDialog = () => {
    setShowProjectTableDialog(false);
    setShowColumnPicker(false);
    // --- IMPROVEMENT #2: Also reset the editing index on close ---
    setEditingQuestionIndex(null);
    resetNewQuestion();
  };

  const openMainDialogForAdd = () => {
    resetNewQuestion();
    setEditingQuestionIndex(null);
    setShowProjectTableDialog(true);
  };
  
  // --- IMPROVEMENT #2: Function to handle starting an edit session ---
  const openMainDialogForEdit = (index: number) => {
    setEditingQuestionIndex(index);
    setNewQuestion(questions[index]);
    setShowProjectTableDialog(true);
  };

  const openColumnPicker = () => { setShowColumnPicker(true); };
  const closeColumnPicker = () => { setShowColumnPicker(false); };

  // --- IMPROVEMENT #2: Renamed from `addQuestion` to be more generic ---
  const handleSaveQuestion = async () => {
    if (!newQuestion.question_label?.trim()) {
      toast.error('Question label is required');
      return;
    }
    // ... (rest of validation logic is the same)
    const hasPartialSelection = newQuestion.target_project_id || newQuestion.target_table_id || newQuestion.target_column_id;
    const hasCompleteSelection = newQuestion.target_project_id && newQuestion.target_table_id && newQuestion.target_column_id;
    if (hasPartialSelection && !hasCompleteSelection) {
      toast.error('Please complete the target selection or clear it');
      return;
    }
    if (hasCompleteSelection) {
      const typeValidation = validateQuestionColumnTypeCompatibility(newQuestion.question_type || 'text', newQuestion.target_column_data_type || 'text');
      if (!typeValidation.compatible) {
        toast.error(`Type mismatch: ${typeValidation.message}`);
        return;
      }
    }

    // --- IMPROVEMENT #2: Logic to either update an existing question or add a new one ---
    if (isEditingQuestion && editingQuestionIndex !== null) {
      // Update existing question
      const updatedQuestions = [...questions];
      updatedQuestions[editingQuestionIndex] = {
        ...questions[editingQuestionIndex],
        ...newQuestion,
      };
      setQuestions(updatedQuestions);
      toast.success('Question updated successfully!');
    } else {
      // Add new question
      const questionToAdd: FormQuestion = {
        id: nanoid(),
        question_order: questions.length + 1,
        question_label: newQuestion.question_label,
        question_description: newQuestion.question_description,
        help_text: newQuestion.help_text,
        is_required: newQuestion.is_required || false,
        is_visible: newQuestion.is_visible !== false,
        question_type: newQuestion.question_type || 'text',
        question_config: newQuestion.question_config || {},
        default_value: newQuestion.default_value,
        placeholder_text: newQuestion.placeholder_text,
        target_project_id: newQuestion.target_project_id || '',
        target_project_name: newQuestion.target_project_name || '',
        target_table_id: newQuestion.target_table_id || '',
        target_table_name: newQuestion.target_table_name || '',
        target_column_id: newQuestion.target_column_id || '',
        target_column_name: newQuestion.target_column_name || '',
        target_column_data_type: newQuestion.target_column_data_type || '',
        creates_relationship: newQuestion.creates_relationship || false,
        relationship_config: newQuestion.relationship_config || {}
      };
      setQuestions([...questions, questionToAdd]);
      toast.success('Question added successfully!');
    }

    closeMainDialog();
  };

  const removeQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index);
    updated.forEach((q, i) => { q.question_order = i + 1; });
    setQuestions(updated);
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === questions.length - 1)) return;
    const updated = [...questions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    updated.forEach((q, i) => { q.question_order = i + 1; });
    setQuestions(updated);
  };

  const handleProjectTableColumnSelection = (selection: any) => {
    setNewQuestion({
      ...newQuestion,
      target_project_id: selection.projectId,
      target_project_name: selection.projectName,
      target_table_id: selection.tableId,
      target_table_name: selection.tableName,
      target_column_id: selection.columnId,
      target_column_name: selection.columnName,
      target_column_data_type: selection.columnDataType
    });
    closeColumnPicker();
  };

  const saveForm = async () => {
    if (!formName.trim()) { toast.error('Form name is required'); return; }
    if (questions.length === 0) { toast.error('At least one question is required'); return; }

    setSaving(true);

    const formPayload = {
      name: formName,
      description: formDescription,
      projectId: projectId,
      successMessage: successMessage,
      failureMessage: failureMessage,
      questions: questions,
    };

    let savedForm;
    try {
      // --- IMPROVEMENT #1 (BUG FIX): Handle both update and create ---
      if (formId) {
        savedForm = await updateForm(formId, formPayload);
      } else {
        savedForm = await createForm(formPayload);
      }

      if (savedForm) {
        toast.success(`Form ${formId ? 'updated' : 'created'} successfully!`);
        // --- IMPROVEMENT #3: Reset dirty state after a successful save ---
        setIsDirty(false);
        onSave?.(savedForm.id);
      }
    } catch (error) {
        // Assuming your hook throws an error on failure
        toast.error("Failed to save the form. Please try again.");
    } finally {
        setSaving(false);
    }
  };

  if (loading) { /* ... loading spinner ... */ }

  return (
    <div className="space-y-6">
      {/* ... Form Settings Card (JSX is unchanged) ... */}
      
      {/* Questions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {/* ... title ... */}
            <Button onClick={openMainDialogForAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add Question
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            /* ... empty state JSX ... */
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No questions yet</p>
              <p>Add questions that map to tables and columns across projects</p>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((question, index) => (
                <Card key={question.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      {/* ... question details JSX is unchanged ... */}
                      <div className="flex-1">
                        {/* ... badges, title, description, mapping info ... */}
                      </div>
                      
                      <div className="flex items-center gap-1 ml-4">
                        {/* ... move up/down buttons ... */}
                        
                        {/* --- IMPROVEMENT #2: Added Edit button --- */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openMainDialogForEdit(index)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        
                        {/* ... delete button with AlertDialog ... */}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
        {/* ... CardFooter with Save button (JSX is unchanged) ... */}
      </Card>

      {/* --- IMPROVEMENT #2: Dialog title and button text are now dynamic --- */}
      <Dialog open={showProjectTableDialog} onOpenChange={(open) => { if (!open) closeMainDialog(); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {isEditingQuestion ? 'Edit Question' : 'Add Cross-Project Question'}
            </DialogTitle>
          </DialogHeader>
          
          {/* ... Dialog content fields (JSX is unchanged) ... */}
          {/* They will be correctly populated by the `newQuestion` state */}

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={closeMainDialog}>Cancel</Button>
            <Button onClick={handleSaveQuestion} disabled={!newQuestion.question_label?.trim()}>
              {isEditingQuestion ? 'Save Changes' : 'Add Question'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProjectTableColumnPicker
        open={showColumnPicker}
        onOpenChange={(open) => { if (!open) closeColumnPicker(); }}
        onSelectionComplete={handleProjectTableColumnSelection}
        currentProjectId={projectId}
        title="Select Target for Cross-Project Form Question"
      />
    </div>
  );
}