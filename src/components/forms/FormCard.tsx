import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
// --- FIX: Corrected the import statement to include all necessary components ---
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import { Share, Copy, Trash2, Calendar, Settings } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Form } from '@/hooks/data/useForms';

interface FormCardProps {
  form: Form;
  projectId: string;
  onShare: (formId: string) => void;
  onDuplicate: (form: Form) => void;
  onDelete: (formId: string) => void;
  // Let's add props for the other actions too
  onManage: (formId: string, formName: string) => void;
  onSettings: (formId: string, formName: string) => void;
}

export function FormCard({ form, projectId, onShare, onDuplicate, onDelete, onManage, onSettings }: FormCardProps) {
  
  // Helper function to stop the Link navigation when a button is clicked
  const handleButtonClick = (e: React.MouseEvent, action: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    action();
  };

  return (
    // The whole card is a link to the form's detail/management page
    <Link to={`/project/${projectId}/form/${form.id}/manage`} className="group block">
      <Card className="relative hover:shadow-lg transition-shadow border-l-4 border-l-blue-500 h-full flex flex-col">
        <CardHeader>
          <div className="flex items-start justify-between">
              <CardTitle className="text-base font-semibold mb-2">{form.name}</CardTitle>
              <Badge variant={form.is_active ? "default" : "secondary"}>
                  {form.is_active ? 'Active' : 'Inactive'}
              </Badge>
          </div>
          <CardDescription className="text-xs line-clamp-2">{form.description}</CardDescription>
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
              <Calendar className="h-3 w-3" />
              <span>{formatDistanceToNow(new Date(form.created_at), { addSuffix: true })}</span>
          </div>
        </CardHeader>
        
        <CardFooter className="mt-auto pt-4 flex justify-end items-center gap-2">
          {/* Action buttons appear on hover for a cleaner look */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Share" onClick={(e) => handleButtonClick(e, () => onShare(form.id))}>
              <Share className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Settings" onClick={(e) => handleButtonClick(e, () => onSettings(form.id, form.name))}>
                <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Duplicate" onClick={(e) => handleButtonClick(e, () => onDuplicate(form))}>
              <Copy className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Delete" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              {/* --- FIX: Added the complete AlertDialog content --- */}
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Form</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{form.name}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(form.id)}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}