import React, { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Plus, Edit3, Eye, Share, Database, Trash2, Calendar, Search, Settings, Copy, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'sonner'
import { formatDistanceToNow, format } from 'date-fns'
import { FormCreator } from '../../components/forms/FormCreator'
import { FormManagement } from '../../components/forms/FormManagement'
import { EnhancedFormSettings } from '../../components/forms/EnhancedFormSettings'

interface Form {
  id: string
  name: string
  description?: string
  form_type: string
  processing_mode: string
  is_active: boolean
  created_at: string
  updated_at?: string
  settings?: any
  field_config?: any[]
}

interface FormsListProps {
  projectId: string
}

export function FormsList({ projectId }: FormsListProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  const [loading, setLoading] = useState(true)
  const [forms, setForms] = useState<Form[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showManageForm, setShowManageForm] = useState<{ formId: string; formName: string } | null>(null)
  const [showFormSettings, setShowFormSettings] = useState<{ formId: string; formName: string } | null>(null)
  
  useEffect(() => {
    loadForms()
  }, [projectId])

  const loadForms = async () => {
    if (!projectId) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', user?.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })

      if (error) throw error
      setForms(data || [])
    } catch (error) {
      console.error('Error loading forms:', error)
      toast.error('Failed to load forms')
    } finally {
      setLoading(false)
    }
  }

  const deleteForm = async (formId: string) => {
    try {
      const { error } = await supabase
        .from('forms')
        .update({ is_deleted: true })
        .eq('id', formId)
        .eq('user_id', user?.id)

      if (error) throw error
      
      toast.success('Form deleted successfully')
      loadForms()
    } catch (error) {
      console.error('Error deleting form:', error)
      toast.error('Failed to delete form')
    }
  }

  const duplicateForm = async (form: Form) => {
    try {
      // Get the original form with questions
      const { data, error } = await supabase.functions.invoke('forms-get', {
        body: { form_id: form.id }
      })

      if (error) throw error
      if (data?.data) {
        const originalForm = data.data
        
        // Create the duplicate
        const { data: createData, error: createError } = await supabase.functions.invoke('forms-create', {
          body: {
            name: `${originalForm.name} (Copy)`,
            description: originalForm.description,
            project_id: projectId,
            success_message: originalForm.success_message,
            failure_message: originalForm.failure_message,
            questions: originalForm.questions.map((q: any) => ({ ...q, id: undefined })),
            settings: originalForm.settings
          }
        })

        if (createError) throw createError
        toast.success('Form duplicated successfully')
        loadForms()
      }
    } catch (error) {
      console.error('Error duplicating form:', error)
      toast.error('Failed to duplicate form')
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      // Try modern Clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
        return true
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        return true
      }
    } catch (err) {
      console.warn('Clipboard operation failed, showing manual copy prompt:', err)
      // Show manual copy instruction as last resort
      const userCopy = prompt('Copy this URL manually:', text)
      return userCopy !== null
    }
  }

  const shareForm = async (formId: string) => {
    try {
      // Generate a public token
      const publicToken = crypto.randomUUID()
      
      // Create or update sharing settings
      const { error } = await supabase
        .from('form_sharing_settings')
        .upsert({
          form_id: formId,
          is_public: true,
          public_url_token: publicToken,
          requires_login: false,
          collect_email: true,
          allow_multiple_submissions: true,
          share_url: `${window.location.origin}/public/forms/${publicToken}`
        })

      if (error) throw error
      
      const publicUrl = `${window.location.origin}/public/forms/${publicToken}`
      
      // Copy to clipboard with fallback
      const copied = await copyToClipboard(publicUrl)
      if (copied) {
        toast.success('Public form URL copied to clipboard!')
      } else {
        toast.error('Could not copy to clipboard. Please copy the URL manually.')
      }
    } catch (error) {
      console.error('Error sharing form:', error)
      toast.error('Failed to create public form URL')
    }
  }

  const filteredForms = forms.filter(form => 
    form.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (form.description && form.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (showCreateForm) {
    return (
      <FormCreator
        projectId={projectId}
        onSave={(formId) => {
          setShowCreateForm(false)
          loadForms()
        }}
        onCancel={() => setShowCreateForm(false)}
      />
    )
  }

  if (showFormSettings) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button 
            onClick={() => setShowFormSettings(null)}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Forms
          </button>
          <span>/</span>
          <span className="text-foreground">{showFormSettings.formName} Settings</span>
        </div>
        
        <EnhancedFormSettings
          formId={showFormSettings.formId}
          formName={showFormSettings.formName}
          formQuestions={[]} // This would need to be loaded from the form
          publicUrl={`${window.location.origin}/form/${showFormSettings.formId}`}
          onSave={() => {
            toast.success('Form settings saved successfully!')
            setShowFormSettings(null)
          }}
        />
      </div>
    )
  }

  if (showManageForm) {
    return (
      <FormManagement
        formId={showManageForm.formId}
        formName={showManageForm.formName}
        onBack={() => setShowManageForm(null)}
      />
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading forms...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Cross-Table Forms</h2>
          <p className="text-muted-foreground">
            Create forms that collect data across multiple tables and columns
          </p>
        </div>
        <Button 
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setShowCreateForm(true)
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Form
        </Button>
      </div>

      {/* Search */}
      {forms.length > 0 && (
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search forms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      )}

      {/* Forms Grid */}
      {filteredForms.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">
                {searchTerm ? 'No forms match your search' : 'No forms created yet'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm 
                  ? 'Try adjusting your search terms'
                  : 'Create your first cross-table form to collect data across multiple database tables'
                }
              </p>
              {!searchTerm && (
                <Button 
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowCreateForm(true)
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Form
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredForms.map((form) => (
            <Card key={form.id} className="relative group hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{form.name}</CardTitle>
                    {form.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {form.description}
                      </p>
                    )}
                  </div>
                  <Badge 
                    variant={form.is_active ? "default" : "secondary"}
                    className="ml-2"
                  >
                    {form.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDistanceToNow(new Date(form.created_at), { addSuffix: true })}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Database className="h-4 w-4" />
                    <span>{form.field_config?.length || 0} questions</span>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {form.form_type}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {form.processing_mode}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardFooter className="flex justify-between gap-2">
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowManageForm({ formId: form.id, formName: form.name })}
                    title="Manage Submissions"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => shareForm(form.id)}
                    title="Share Form"
                  >
                    <Share className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFormSettings({ formId: form.id, formName: form.name })}
                    title="Form Settings"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => duplicateForm(form)}
                    title="Duplicate Form"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Edit form functionality - would need FormCreator in edit mode
                      toast.info('Form editing coming soon!')
                    }}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Form</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{form.name}"? This will also delete all associated submissions. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteForm(form.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}