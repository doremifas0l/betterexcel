import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { Share, Copy, QrCode, Link, Globe, Lock, Calendar, Mail, Users, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface FormSharingDialogProps {
  formId: string
  formName: string
  children?: React.ReactNode
}

export function FormSharingDialog({ formId, formName, children }: FormSharingDialogProps) {
  const [open, setOpen] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // Sharing settings state
  const [isPublic, setIsPublic] = useState(true)
  const [accessType, setAccessType] = useState<'public' | 'password_protected'>('public')
  const [formPassword, setFormPassword] = useState('')
  const [requiresPasscode, setRequiresPasscode] = useState(false)
  const [passcode, setPasscode] = useState('')
  const [collectEmail, setCollectEmail] = useState(false)
  const [allowMultiple, setAllowMultiple] = useState(true)
  const [closeDate, setCloseDate] = useState('')
  const [maxSubmissions, setMaxSubmissions] = useState('')
  const [closeMessage, setCloseMessage] = useState('This form is no longer accepting submissions.')
  
  // Load existing sharing settings when dialog opens
  useEffect(() => {
    if (open && formId) {
      loadSharingSettings()
    }
  }, [open, formId])
  
  const loadSharingSettings = async () => {
    setLoading(true)
    try {
      const { supabase } = await import('@/lib/supabase')
      
      // Get form sharing settings
      const { data, error } = await supabase
        .from('form_sharing_settings')
        .select('*')
        .eq('form_id', formId)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error
      }
      
      // Load settings if they exist
      if (data) {
        setAccessType(data.access_type || 'public')
        setFormPassword(data.form_password || '')
        setRequiresPasscode(data.requires_passcode || false)
        setPasscode(data.passcode_hash || '')
        setCollectEmail(data.collect_email || false)
        setAllowMultiple(data.allow_multiple_submissions !== false)
        setCloseDate(data.close_date || '')
        setMaxSubmissions(data.max_submissions ? data.max_submissions.toString() : '')
      }
      
      // Get form basic settings
      const { data: formData, error: formError } = await supabase
        .from('forms')
        .select('closed_message, is_active')
        .eq('id', formId)
        .single()
        
      if (formError) throw formError
      
      if (formData) {
        setCloseMessage(formData.closed_message || 'This form is no longer accepting submissions.')
        setIsPublic(formData.is_active !== false)
      }
      
    } catch (error: any) {
      console.error('Error loading sharing settings:', error)
      // Don't show error toast for missing settings - use defaults
      if (error.code !== 'PGRST116') {
        toast.error('Failed to load current sharing settings')
      }
    } finally {
      setLoading(false)
    }
  }
  
  // Generate share URL
  const baseUrl = window.location.origin
  const shareUrl = `${baseUrl}/form/${formId}`
  const embedCode = `<iframe src="${shareUrl}" width="100%" height="600" frameborder="0"></iframe>`
  
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard!`)
  }
  
  const openInNewTab = () => {
    window.open(shareUrl, '_blank')
  }
  
  const updateSharingSettings = async () => {
    if (!isPublic && requiresPasscode && !passcode.trim()) {
      toast.error('Passcode is required when passcode protection is enabled')
      return
    }

    if (accessType === 'password_protected' && !formPassword.trim()) {
      toast.error('Password is required for password-protected access')
      return
    }

    if (maxSubmissions && parseInt(maxSubmissions) < 1) {
      toast.error('Maximum submissions must be a positive number')
      return
    }

    setSharing(true)
    try {
      const { supabase } = await import('@/lib/supabase')
      
      const { data, error } = await supabase.functions.invoke('forms-advanced', {
        body: {
          action: 'update_form_settings',
          form_id: formId,
          settings: {
            sharing: {
              is_public: isPublic,
              access_type: accessType,
              form_password: accessType === 'password_protected' ? formPassword : null,
              requires_passcode: requiresPasscode,
              passcode_hash: requiresPasscode ? passcode : null,
              collect_email: collectEmail,
              allow_multiple_submissions: allowMultiple,
              close_date: closeDate || null,
              max_submissions: maxSubmissions ? parseInt(maxSubmissions) : null,
              mobile_optimized: true
            },
            closed_message: closeMessage
          }
        }
      })

      if (error) throw error

      toast.success('Sharing settings updated successfully!')
    } catch (error: any) {
      console.error('Error updating sharing settings:', error)
      toast.error(error.message || 'Failed to update sharing settings')
    } finally {
      setSharing(false)
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Share className="h-4 w-4 mr-2" />
            Share Form
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share className="h-5 w-5" />
            Share Form: {formName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading sharing settings...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Quick Share */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Public Link</Label>
                  <Badge variant={isPublic ? "default" : "secondary"}>
                    {isPublic ? "Public" : "Private"}
                  </Badge>
                </div>
                
                <div className="flex gap-2">
                  <Input 
                    value={shareUrl} 
                    readOnly 
                    className="font-mono text-sm"
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => copyToClipboard(shareUrl, 'Form link')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={openInNewTab}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex gap-2 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  <span>Anyone with this link can submit responses</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Embed Code */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <Label className="text-base font-medium">Embed Code</Label>
                <div className="flex gap-2">
                  <Textarea 
                    value={embedCode}
                    readOnly 
                    className="font-mono text-xs resize-none"
                    rows={2}
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => copyToClipboard(embedCode, 'Embed code')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  Paste this HTML code into your website to embed the form
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Advanced Settings */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <Label className="text-base font-medium">Sharing Settings</Label>
                
                <div className="space-y-4">
                  {/* Public Access */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="public-access">Public Access</Label>
                      <div className="text-sm text-muted-foreground">
                        Allow anyone to access and submit the form
                      </div>
                    </div>
                    <Switch
                      id="public-access"
                      checked={isPublic}
                      onCheckedChange={setIsPublic}
                    />
                  </div>
                  
                  {/* Access Control */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Form Access Control</Label>
                    <div className="text-sm text-muted-foreground mb-3">
                      Choose who can access this form
                    </div>
                    <RadioGroup
                      value={accessType}
                      onValueChange={(value: 'public' | 'password_protected') => setAccessType(value)}
                      className="space-y-3"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="public" id="access-public" />
                        <Label htmlFor="access-public" className="flex-1">
                          <div className="font-medium">Public</div>
                          <div className="text-sm text-muted-foreground">
                            Anyone with the link can access the form
                          </div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="password_protected" id="access-password" />
                        <Label htmlFor="access-password" className="flex-1">
                          <div className="font-medium">Password Protected</div>
                          <div className="text-sm text-muted-foreground">
                            Require a password to access the form
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>
                    
                    {accessType === 'password_protected' && (
                      <div className="mt-3 ml-6">
                        <Label htmlFor="form-password" className="text-sm">Form Password</Label>
                        <Input
                          id="form-password"
                          placeholder="Enter password for form access"
                          type="password"
                          value={formPassword}
                          onChange={(e) => setFormPassword(e.target.value)}
                          className="w-64 mt-1"
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Passcode Protection */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="passcode-protection">Passcode Protection</Label>
                        <div className="text-sm text-muted-foreground">
                          Require a passcode to access the form
                        </div>
                      </div>
                      <Switch
                        id="passcode-protection"
                        checked={requiresPasscode}
                        onCheckedChange={setRequiresPasscode}
                      />
                    </div>
                    
                    {requiresPasscode && (
                      <div className="ml-6">
                        <Input
                          placeholder="Enter passcode"
                          type="password"
                          value={passcode}
                          onChange={(e) => setPasscode(e.target.value)}
                          className="w-48"
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Email Collection */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="collect-email">Collect Email</Label>
                      <div className="text-sm text-muted-foreground">
                        Ask for submitter's email address
                      </div>
                    </div>
                    <Switch
                      id="collect-email"
                      checked={collectEmail}
                      onCheckedChange={setCollectEmail}
                    />
                  </div>
                  
                  {/* Multiple Submissions */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="allow-multiple">Multiple Submissions</Label>
                      <div className="text-sm text-muted-foreground">
                        Allow users to submit multiple responses
                      </div>
                    </div>
                    <Switch
                      id="allow-multiple"
                      checked={allowMultiple}
                      onCheckedChange={setAllowMultiple}
                    />
                  </div>
                  
                  {/* Form Expiration */}
                  <div className="space-y-2">
                    <Label htmlFor="close-date">Form Expiration (Optional)</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Input
                          id="close-date"
                          type="datetime-local"
                          value={closeDate}
                          onChange={(e) => setCloseDate(e.target.value)}
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          placeholder="Max submissions"
                          type="number"
                          value={maxSubmissions}
                          onChange={(e) => setMaxSubmissions(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Form will close automatically on the date or after max submissions
                    </div>
                  </div>
                  
                  {/* Close Message */}
                  <div className="space-y-2">
                    <Label htmlFor="close-message">Form Closed Message</Label>
                    <Textarea
                      id="close-message"
                      placeholder="Message to show when form is closed"
                      value={closeMessage}
                      onChange={(e) => setCloseMessage(e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Form Status */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <Label className="text-base font-medium">Form Status</Label>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isPublic ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                    <span>{isPublic ? 'Active' : 'Inactive'}</span>
                  </div>
                  
                  {accessType === 'password_protected' && (
                    <div className="flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      <span>Password Protected</span>
                    </div>
                  )}
                  
                  {requiresPasscode && (
                    <div className="flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      <span>Passcode Protected</span>
                    </div>
                  )}
                  
                  {closeDate && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>Expires {format(new Date(closeDate), 'MMM d, yyyy')}</span>
                    </div>
                  )}
                  
                  {collectEmail && (
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      <span>Email required</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button onClick={updateSharingSettings} disabled={sharing || loading}>
              {sharing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating...
                </>
              ) : (
                'Update Settings'
              )}
            </Button>
          </div>
          </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}