import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Settings, Calendar, Shield, Users, Smartphone, Plus, Trash2, Eye, QrCode } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'sonner'
import { QRCodeDisplay } from '../shared/QRCodeDisplay'

interface FormSettings {
  unique_columns: Array<{
    question_id: string
    field_name: string
  }>
  closed_message: string
  sharing: {
    access_type: 'public' | 'password_protected'
    form_password?: string
    requires_passcode: boolean
    passcode_hash?: string
    close_date?: string
    collect_email: boolean
    allow_multiple_submissions: boolean
    mobile_optimized: boolean
    max_submissions?: number
  }
}

interface EnhancedFormSettingsProps {
  formId: string
  formName: string
  formQuestions: Array<{
    id: string
    question_label: string
    question_type: string
  }>
  currentSettings?: Partial<FormSettings>
  publicUrl: string
  onSave?: (settings: FormSettings) => void
}

export function EnhancedFormSettings({ 
  formId, 
  formName, 
  formQuestions, 
  currentSettings, 
  publicUrl,
  onSave 
}: EnhancedFormSettingsProps) {
  const { user } = useAuth()
  const [settings, setSettings] = useState<FormSettings>({
    unique_columns: [],
    closed_message: 'This form is no longer accepting submissions.',
    sharing: {
      access_type: 'public',
      requires_passcode: false,
      collect_email: false,
      allow_multiple_submissions: true,
      mobile_optimized: true
    }
  })
  
  const [passcode, setPasscode] = useState('')
  const [confirmPasscode, setConfirmPasscode] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [showDialog, setShowDialog] = useState(false)

  useEffect(() => {
    if (currentSettings) {
      setSettings({
        unique_columns: currentSettings.unique_columns || [],
        closed_message: currentSettings.closed_message || 'This form is no longer accepting submissions.',
        sharing: {
          access_type: currentSettings.sharing?.access_type || 'public',
          form_password: currentSettings.sharing?.form_password,
          requires_passcode: currentSettings.sharing?.requires_passcode || false,
          close_date: currentSettings.sharing?.close_date,
          collect_email: currentSettings.sharing?.collect_email || false,
          allow_multiple_submissions: currentSettings.sharing?.allow_multiple_submissions !== false,
          mobile_optimized: currentSettings.sharing?.mobile_optimized !== false,
          max_submissions: currentSettings.sharing?.max_submissions
        }
      })
      
      // Set form password for editing if exists
      if (currentSettings.sharing?.form_password) {
        setFormPassword(currentSettings.sharing.form_password)
      }
    }
  }, [currentSettings])

  const addUniqueColumn = (questionId: string) => {
    const question = formQuestions.find(q => q.id === questionId)
    if (!question) return
    
    const alreadyAdded = settings.unique_columns.some(uc => uc.question_id === questionId)
    if (alreadyAdded) {
      toast.error('This field is already marked as unique')
      return
    }
    
    setSettings(prev => ({
      ...prev,
      unique_columns: [
        ...prev.unique_columns,
        {
          question_id: questionId,
          field_name: question.question_label
        }
      ]
    }))
  }

  const removeUniqueColumn = (questionId: string) => {
    setSettings(prev => ({
      ...prev,
      unique_columns: prev.unique_columns.filter(uc => uc.question_id !== questionId)
    }))
  }

  const handleSave = async () => {
    // Validate password if access type is password protected
    if (settings.sharing.access_type === 'password_protected') {
      if (!formPassword) {
        toast.error('Please enter a password for password-protected access')
        return
      }
      if (formPassword.length < 4) {
        toast.error('Password must be at least 4 characters')
        return
      }
    }
    
    // Validate passcode if required
    if (settings.sharing.requires_passcode) {
      if (!passcode) {
        toast.error('Please enter a passcode')
        return
      }
      if (passcode !== confirmPasscode) {
        toast.error('Passcodes do not match')
        return
      }
      if (passcode.length < 4) {
        toast.error('Passcode must be at least 4 characters')
        return
      }
    }

    setSaving(true)
    try {
      // Check if user is authenticated
      if (!user || !user.id) {
        toast.error('You must be logged in to save form settings')
        setSaving(false)
        return
      }

      const settingsToSave = {
        ...settings,
        sharing: {
          ...settings.sharing,
          form_password: settings.sharing.access_type === 'password_protected' ? formPassword : null,
          passcode_hash: settings.sharing.requires_passcode ? passcode : undefined
        }
      }

      const { data, error } = await supabase.functions.invoke('forms-advanced', {
        body: {
          action: 'update_form_settings',
          form_id: formId,
          user_id: user.id,
          settings: settingsToSave
        }
      })

      if (error) throw error
      
      toast.success('Form settings updated successfully')
      onSave?.(settingsToSave)
      setShowDialog(false)
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const availableQuestions = formQuestions.filter(q => 
    ['text', 'email', 'number'].includes(q.question_type)
  )

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Settings className="h-4 w-4 mr-2" />
          Advanced Settings
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Advanced Settings - {formName}
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="sharing" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sharing">Sharing</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="validation">Validation</TabsTrigger>
            <TabsTrigger value="mobile">Mobile</TabsTrigger>
          </TabsList>
          
          <TabsContent value="sharing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Form Access
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="close-date">Close Date (Optional)</Label>
                    <Input
                      id="close-date"
                      type="datetime-local"
                      value={settings.sharing.close_date || ''}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        sharing: { ...prev.sharing, close_date: e.target.value }
                      }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Form will automatically close after this date
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="max-submissions">Max Submissions (Optional)</Label>
                    <Input
                      id="max-submissions"
                      type="number"
                      min="1"
                      value={settings.sharing.max_submissions || ''}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        sharing: { 
                          ...prev.sharing, 
                          max_submissions: e.target.value ? parseInt(e.target.value) : undefined 
                        }
                      }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Form will close after reaching this number
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="closed-message">Closed Message</Label>
                  <Textarea
                    id="closed-message"
                    value={settings.closed_message}
                    onChange={(e) => setSettings(prev => ({ ...prev, closed_message: e.target.value }))}
                    placeholder="Message shown when form is closed"
                    rows={3}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="collect-email">Collect Email Addresses</Label>
                    <p className="text-xs text-muted-foreground">
                      Add optional email field to form
                    </p>
                  </div>
                  <Switch
                    id="collect-email"
                    checked={settings.sharing.collect_email}
                    onCheckedChange={(checked) => setSettings(prev => ({
                      ...prev,
                      sharing: { ...prev.sharing, collect_email: checked }
                    }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="multiple-submissions">Allow Multiple Submissions</Label>
                    <p className="text-xs text-muted-foreground">
                      Allow users to submit multiple times
                    </p>
                  </div>
                  <Switch
                    id="multiple-submissions"
                    checked={settings.sharing.allow_multiple_submissions}
                    onCheckedChange={(checked) => setSettings(prev => ({
                      ...prev,
                      sharing: { ...prev.sharing, allow_multiple_submissions: checked }
                    }))}
                  />
                </div>
                
                {/* QR Code Section */}
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>QR Code Sharing</Label>
                      <p className="text-xs text-muted-foreground">
                        Generate QR code for easy mobile access
                      </p>
                    </div>
                    <QRCodeDisplay
                      formId={formId}
                      formName={formName}
                      publicUrl={publicUrl}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Form Access Control
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Access Type</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Choose who can access this form
                  </p>
                  
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        id="access-public"
                        name="access_type"
                        value="public"
                        checked={settings.sharing.access_type === 'public'}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          sharing: { ...prev.sharing, access_type: 'public' }
                        }))}
                        className="w-4 h-4 text-blue-600"
                      />
                      <div className="flex-1">
                        <Label htmlFor="access-public" className="font-medium cursor-pointer">
                          Public
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Anyone with the link can access the form (default)
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        id="access-password"
                        name="access_type"
                        value="password_protected"
                        checked={settings.sharing.access_type === 'password_protected'}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          sharing: { ...prev.sharing, access_type: 'password_protected' }
                        }))}
                        className="w-4 h-4 text-blue-600"
                      />
                      <div className="flex-1">
                        <Label htmlFor="access-password" className="font-medium cursor-pointer">
                          Password Protected
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Require a password to access the form
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {settings.sharing.access_type === 'password_protected' && (
                    <div className="mt-4 ml-6">
                      <Label htmlFor="form-password" className="text-sm">Form Password</Label>
                      <Input
                        id="form-password"
                        placeholder="Enter password for form access (min 4 characters)"
                        type="password"
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        className="w-full mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Users will need this password to access your form
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Additional Security (Optional)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="requires-passcode">Require Additional Passcode</Label>
                    <p className="text-xs text-muted-foreground">
                      Add an extra passcode layer after accessing the form
                    </p>
                  </div>
                  <Switch
                    id="requires-passcode"
                    checked={settings.sharing.requires_passcode}
                    onCheckedChange={(checked) => setSettings(prev => ({
                      ...prev,
                      sharing: { ...prev.sharing, requires_passcode: checked }
                    }))}
                  />
                </div>
                
                {settings.sharing.requires_passcode && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="passcode">Additional Passcode</Label>
                      <Input
                        id="passcode"
                        type="password"
                        value={passcode}
                        onChange={(e) => setPasscode(e.target.value)}
                        placeholder="Enter passcode (min 4 characters)"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="confirm-passcode">Confirm Passcode</Label>
                      <Input
                        id="confirm-passcode"
                        type="password"
                        value={confirmPasscode}
                        onChange={(e) => setConfirmPasscode(e.target.value)}
                        placeholder="Confirm passcode"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="validation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Duplicate Prevention
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Unique Fields</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Select fields that should be unique across all submissions
                  </p>
                  
                  {settings.unique_columns.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {settings.unique_columns.map((uniqueCol, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-blue-50 rounded">
                          <span className="text-sm font-medium">{uniqueCol.field_name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeUniqueColumn(uniqueCol.question_id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {availableQuestions.length > settings.unique_columns.length && (
                    <Select onValueChange={addUniqueColumn}>
                      <SelectTrigger>
                        <SelectValue placeholder="Add unique field" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableQuestions
                          .filter(q => !settings.unique_columns.some(uc => uc.question_id === q.id))
                          .map(question => (
                            <SelectItem key={question.id} value={question.id}>
                              {question.question_label} ({question.question_type})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                  
                  {settings.unique_columns.length > 0 && (
                    <div className="mt-3 p-3 bg-yellow-50 rounded">
                      <p className="text-xs text-yellow-800">
                        <strong>Note:</strong> Submissions with duplicate values in these fields will be flagged for manual review.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="mobile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  Mobile Optimization
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="mobile-optimized">Mobile Optimized</Label>
                    <p className="text-xs text-muted-foreground">
                      Optimize form layout and interactions for mobile devices
                    </p>
                  </div>
                  <Switch
                    id="mobile-optimized"
                    checked={settings.sharing.mobile_optimized}
                    onCheckedChange={(checked) => setSettings(prev => ({
                      ...prev,
                      sharing: { ...prev.sharing, mobile_optimized: checked }
                    }))}
                  />
                </div>
                
                {settings.sharing.mobile_optimized && (
                  <div className="p-3 bg-green-50 rounded">
                    <div className="flex items-start gap-2">
                      <Badge variant="secondary" className="text-xs">
                        Mobile Ready
                      </Badge>
                      <div className="text-xs text-green-800">
                        <p className="font-medium mb-1">Features enabled:</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Responsive design for all screen sizes</li>
                          <li>Touch-optimized input controls</li>
                          <li>Improved keyboard support</li>
                          <li>Large tap targets for better usability</li>
                          <li>Progressive form layout</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => setShowDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </div>
            ) : (
              'Save Settings'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}