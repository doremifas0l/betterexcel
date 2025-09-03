import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Send, AlertCircle, CheckCircle, Database, Table2, Link2, Lock, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface FormQuestion {
  id: string
  question_order: number
  question_label: string
  question_description?: string
  help_text?: string
  is_required: boolean
  is_visible: boolean
  question_type: string
  question_config: any
  default_value?: string
  placeholder_text?: string
  target_table: { id: string; name: string }
  target_column: { id: string; name: string; data_type: string }
  creates_relationship: boolean
  relationship_config: any
}

interface FormStructure {
  id: string
  name: string
  description?: string
  success_message?: string
  failure_message?: string
  questions: FormQuestion[]
  cross_table_mapping: any
  is_public_access: boolean
  sharing_settings?: any
  // Slice 2.6 features
  passcode?: string
  close_date?: string
  close_message?: string
  unique_columns?: string[]
  use_staging?: boolean
  table_name: string
}

interface PublicFormRendererProps {
  formId?: string
  publicToken?: string
  onSubmissionComplete?: (submissionId: string) => void
}

export function PublicFormRenderer({ formId, publicToken, onSubmissionComplete }: PublicFormRendererProps) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormStructure | null>(null)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [submitterEmail, setSubmitterEmail] = useState('')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [currentStep, setCurrentStep] = useState(1)
  
  // Slice 2.6 states
  const [passcode, setPasscode] = useState('')
  const [showPasscodeDialog, setShowPasscodeDialog] = useState(false)
  const [passcodeValidated, setPasscodeValidated] = useState(false)
  const [formClosed, setFormClosed] = useState(false)
  
  // Password-based access control states
  const [formPassword, setFormPassword] = useState('')
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [passwordValidated, setPasswordValidated] = useState(false)
  
  useEffect(() => {
    loadForm()
  }, [formId, publicToken])
  
  useEffect(() => {
    // Check if form needs passcode validation
    if (form && form.passcode && !passcodeValidated) {
      setShowPasscodeDialog(true)
    }
    
    // Check if form is closed
    if (form && form.close_date) {
      const closeDate = new Date(form.close_date)
      const now = new Date()
      if (now > closeDate) {
        setFormClosed(true)
      }
    }
  }, [form, passcodeValidated])

  const loadForm = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const { data, error } = await supabase.functions.invoke('forms-get', {
        body: {
          form_id: formId,
          public_token: publicToken,
          password: formPassword || undefined
        }
      })

      if (error) {
        // Handle password-required error
        if (error.error?.code === 'PASSWORD_REQUIRED') {
          setShowPasswordDialog(true)
          return
        }
        
        // Handle invalid password error
        if (error.error?.code === 'INVALID_PASSWORD') {
          setFormPassword('')
          setShowPasswordDialog(true)
          toast.error('Invalid password. Please try again.')
          return
        }
        
        throw error
      }
      
      if (!data?.data) throw new Error('Form not found')
      
      const formData = data.data
      setForm(formData)
      setPasswordValidated(true)
      setShowPasswordDialog(false)
      
      // Initialize answers with default values
      const defaultAnswers: Record<string, any> = {}
      formData.questions.forEach((q: FormQuestion) => {
        if (q.default_value) {
          defaultAnswers[q.id] = q.default_value
        }
      })
      setAnswers(defaultAnswers)
      
    } catch (error) {
      console.error('Error loading form:', error)
      setError(error instanceof Error ? error.message : 'Failed to load form')
    } finally {
      setLoading(false)
    }
  }

  const validateAnswer = (question: FormQuestion, value: any): string | null => {
    if (question.is_required && (!value || value.toString().trim() === '')) {
      return `${question.question_label} is required`
    }
    
    if (value && question.question_type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(value)) {
        return 'Please enter a valid email address'
      }
    }
    
    if (value && question.question_type === 'number') {
      if (isNaN(Number(value))) {
        return 'Please enter a valid number'
      }
    }
    
    return null
  }

  const validateAllAnswers = (): boolean => {
    if (!form) return false
    
    const errors: Record<string, string> = {}
    
    form.questions.forEach(question => {
      if (!question.is_visible) return
      
      const error = validateAnswer(question, answers[question.id])
      if (error) {
        errors[question.id] = error
      }
    })
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
    
    // Clear validation error for this question
    if (validationErrors[questionId]) {
      setValidationErrors(prev => {
        const { [questionId]: removed, ...rest } = prev
        return rest
      })
    }
  }

  const validatePasscode = async () => {
    if (!form || !form.passcode) return
    
    if (!passcode) {
      toast.error('Please enter the passcode')
      return
    }
    
    if (passcode === form.passcode) {
      setPasscodeValidated(true)
      setShowPasscodeDialog(false)
      toast.success('Passcode accepted')
    } else {
      toast.error('Invalid passcode')
      setPasscode('')
    }
  }

  const validatePassword = async () => {
    if (!formPassword) {
      toast.error('Please enter the password')
      return
    }
    
    // Re-attempt to load the form with the password
    setLoading(true)
    loadForm()
  }

  const submitForm = async () => {
    if (!form) return
    
    if (!validateAllAnswers()) {
      toast.error('Please fix the errors below')
      return
    }
    
    setSubmitting(true)
    setError(null)
    
    try {
      // Use the enhanced form submission endpoint
      const { data, error } = await supabase.functions.invoke('forms-submit-enhanced', {
        body: {
          form_id: formId,
          submission_data: answers,
          passcode: form.passcode ? passcode : undefined
        }
      })

      if (error) throw error
      
      if (data?.success) {
        setSubmitted(true)
        const message = data.staging 
          ? 'Your submission has been received and is under review'
          : (data.message || form.success_message || 'Form submitted successfully!')
        toast.success(message)
        onSubmissionComplete?.(data.submission_id || 'staged')
      }
    } catch (error) {
      console.error('Error submitting form:', error)
      let errorMessage = 'Submission failed'
      
      if (error && typeof error === 'object' && 'error' in error) {
        const err = error.error as any
        switch (err.code) {
          case 'INVALID_PASSCODE':
            errorMessage = 'Invalid passcode provided'
            break
          case 'FORM_CLOSED':
            errorMessage = err.message || 'This form is no longer accepting submissions'
            setFormClosed(true)
            break
          case 'DUPLICATE_SUBMISSION':
            errorMessage = err.message || 'A submission with this information already exists'
            break
          default:
            errorMessage = err.message || errorMessage
        }
      } else if (error instanceof Error) {
        errorMessage = error.message
      }
      
      setError(errorMessage)
      toast.error(form.failure_message || errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  const renderQuestionInput = (question: FormQuestion) => {
    const value = answers[question.id] || ''
    const hasError = validationErrors[question.id]
    
    const baseInputProps = {
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => 
        handleAnswerChange(question.id, e.target.value),
      placeholder: question.placeholder_text || '',
      className: hasError ? 'border-red-500' : ''
    }
    
    switch (question.question_type) {
      case 'textarea':
        return <Textarea {...baseInputProps} rows={4} />
      
      case 'number':
        return <Input {...baseInputProps} type="number" />
      
      case 'email':
        return <Input {...baseInputProps} type="email" />
      
      case 'phone':
        return <Input {...baseInputProps} type="tel" />
      
      case 'date':
        return <Input {...baseInputProps} type="date" />
      
      case 'datetime':
        return <Input {...baseInputProps} type="datetime-local" />
      
      case 'select':
        const options = question.question_config?.options || []
        return (
          <Select value={value} onValueChange={(val) => handleAnswerChange(question.id, val)}>
            <SelectTrigger className={hasError ? 'border-red-500' : ''}>
              <SelectValue placeholder={question.placeholder_text || 'Select an option'} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option: any, index: number) => (
                <SelectItem key={index} value={option.value || option}>
                  {option.label || option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      
      case 'radio':
        const radioOptions = question.question_config?.options || []
        return (
          <RadioGroup value={value} onValueChange={(val) => handleAnswerChange(question.id, val)}>
            {radioOptions.map((option: any, index: number) => (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value || option} id={`${question.id}-${index}`} />
                <Label htmlFor={`${question.id}-${index}`}>{option.label || option}</Label>
              </div>
            ))}
          </RadioGroup>
        )
      
      case 'checkbox':
        const checkboxOptions = question.question_config?.options || []
        const selectedOptions = Array.isArray(value) ? value : []
        return (
          <div className="space-y-2">
            {checkboxOptions.map((option: any, index: number) => (
              <div key={index} className="flex items-center space-x-2">
                <Checkbox
                  id={`${question.id}-${index}`}
                  checked={selectedOptions.includes(option.value || option)}
                  onCheckedChange={(checked) => {
                    const optionValue = option.value || option
                    if (checked) {
                      handleAnswerChange(question.id, [...selectedOptions, optionValue])
                    } else {
                      handleAnswerChange(question.id, selectedOptions.filter((v: any) => v !== optionValue))
                    }
                  }}
                />
                <Label htmlFor={`${question.id}-${index}`}>{option.label || option}</Label>
              </div>
            ))}
          </div>
        )
      
      case 'boolean':
        return (
          <RadioGroup value={value.toString()} onValueChange={(val) => handleAnswerChange(question.id, val === 'true')}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="true" id={`${question.id}-yes`} />
              <Label htmlFor={`${question.id}-yes`}>Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="false" id={`${question.id}-no`} />
              <Label htmlFor={`${question.id}-no`}>No</Label>
            </div>
          </RadioGroup>
        )
      
      default:
        return <Input {...baseInputProps} type="text" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading form...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Form Not Available</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={loadForm}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  // Check if form is closed
  if (formClosed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Clock className="h-12 w-12 text-orange-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Form Closed</h3>
              <p className="text-muted-foreground mb-4">
                {form?.close_message || 'This form is no longer accepting submissions.'}
              </p>
              {form?.close_date && (
                <p className="text-xs text-muted-foreground">
                  Closed on {new Date(form.close_date).toLocaleString()}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Thank You!</h3>
              <p className="text-muted-foreground mb-4">
                {form?.success_message || 'Your form has been submitted successfully.'}
              </p>
              {form?.use_staging && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your submission is under review and will be processed shortly.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!form) {
    return null
  }

  const visibleQuestions = form.questions.filter(q => q.is_visible)
  const progress = ((Object.keys(answers).length) / visibleQuestions.length) * 100

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Form Header */}
        <Card className="mb-8">
          <CardHeader>
            <div className="text-center">
              <CardTitle className="text-2xl font-bold mb-2">{form.name}</CardTitle>
              {form.description && (
                <p className="text-muted-foreground">{form.description}</p>
              )}
            </div>
            
            {/* Progress */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                <span>Progress</span>
                <span>{Math.round(progress)}% complete</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
            
            {/* Cross-table info */}
            <Alert>
              <Database className="h-4 w-4" />
              <AlertDescription>
                This form will distribute your answers across {Object.keys(form.cross_table_mapping).length} different tables.
              </AlertDescription>
            </Alert>
          </CardHeader>
        </Card>

        {/* Form Questions */}
        <div className="space-y-6">
          {visibleQuestions.map((question, index) => (
            <Card key={question.id}>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Label className="text-base font-medium flex items-center gap-2">
                        {question.question_label}
                        {question.is_required && <span className="text-red-500">*</span>}
                      </Label>
                      
                      {question.question_description && (
                        <p className="text-sm text-muted-foreground mt-1">{question.question_description}</p>
                      )}
                      
                      {question.help_text && (
                        <p className="text-xs text-muted-foreground mt-1">{question.help_text}</p>
                      )}
                    </div>
                    
                    <Badge variant="outline" className="ml-2 text-xs">
                      {index + 1} of {visibleQuestions.length}
                    </Badge>
                  </div>
                  
                  {/* Cross-table mapping info */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground bg-gray-50 p-2 rounded">
                    <div className="flex items-center gap-1">
                      <Table2 className="h-3 w-3" />
                      <span>{question.target_table.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Database className="h-3 w-3" />
                      <span>{question.target_column.name}</span>
                    </div>
                    {question.creates_relationship && (
                      <div className="flex items-center gap-1">
                        <Link2 className="h-3 w-3" />
                        <span>Linked</span>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    {renderQuestionInput(question)}
                    
                    {validationErrors[question.id] && (
                      <p className="text-sm text-red-500 mt-1">{validationErrors[question.id]}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Email Collection */}
          {form.sharing_settings?.collect_email && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address (Optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={submitterEmail}
                    onChange={(e) => setSubmitterEmail(e.target.value)}
                    placeholder="your@email.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    We'll use this to contact you about your submission if needed.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submit */}
          <Card>
            <CardFooter>
              <Button 
                onClick={submitForm} 
                disabled={submitting}
                className="w-full"
                size="lg"
              >
                {submitting ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Submitting across tables...
                  </div>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Form
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
      
      {/* Passcode Dialog */}
      <Dialog open={showPasscodeDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Enter Passcode
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This form requires a passcode to access. Please enter the correct passcode to continue.
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="passcode">Passcode</Label>
              <Input
                id="passcode"
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter passcode"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    validatePasscode()
                  }
                }}
                autoFocus
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => window.history.back()}>
                Cancel
              </Button>
              <Button onClick={validatePasscode} disabled={!passcode}>
                Access Form
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Password Required
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This form is password protected. Please enter the password to access the form.
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="form-password">Password</Label>
              <Input
                id="form-password"
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="Enter password"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    validatePassword()
                  }
                }}
                autoFocus
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => window.history.back()}>
                Cancel
              </Button>
              <Button onClick={validatePassword} disabled={!formPassword || loading}>
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Checking...
                  </>
                ) : (
                  'Access Form'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}