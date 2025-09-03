import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CheckCircle, XCircle, AlertCircle, Eye, Users, Clock, FileText, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'

interface StagingSubmission {
  id: string
  form_id: string
  submission_data: any
  submitter_email?: string
  validation_status: string
  validation_errors: any
  duplicate_check_status: string
  duplicate_of?: string
  stage_reason: string
  staged_at: string
  review_action?: string
  review_notes?: string
  reviewed_at?: string
}

interface StagingReviewProps {
  formId: string
  formName: string
  onClose?: () => void
}

export function StagingReview({ formId, formName, onClose }: StagingReviewProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [submissions, setSubmissions] = useState<StagingSubmission[]>([])
  const [selectedSubmissions, setSelectedSubmissions] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState<StagingSubmission | null>(null)
  const [bulkAction, setBulkAction] = useState('')
  const [reviewNotes, setReviewNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  
  const pageSize = 20

  useEffect(() => {
    loadStagingSubmissions()
  }, [formId, currentPage, statusFilter])

  const loadStagingSubmissions = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('forms-advanced', {
        body: {
          action: 'get_staging_submissions',
          form_id: formId,
          limit: pageSize,
          offset: currentPage * pageSize,
          status_filter: statusFilter || undefined
        }
      })

      if (error) throw error
      if (data?.data) {
        setSubmissions(data.data.submissions)
        setTotalCount(data.data.pagination.total)
      }
    } catch (error) {
      console.error('Error loading staging submissions:', error)
      toast.error('Failed to load staged submissions')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectionToggle = (submissionId: string) => {
    setSelectedSubmissions(prev => 
      prev.includes(submissionId) 
        ? prev.filter(id => id !== submissionId)
        : [...prev, submissionId]
    )
  }

  const handleSelectAll = () => {
    if (selectedSubmissions.length === submissions.length) {
      setSelectedSubmissions([])
    } else {
      setSelectedSubmissions(submissions.map(s => s.id))
    }
  }

  const processBulkAction = async () => {
    if (!bulkAction || selectedSubmissions.length === 0) {
      toast.error('Please select submissions and an action')
      return
    }

    setProcessing(true)
    try {
      const { data, error } = await supabase.functions.invoke('forms-advanced', {
        body: {
          action: 'process_staging_batch',
          submission_ids: selectedSubmissions,
          bulk_action: bulkAction,
          user_id: user?.id,
          review_notes: reviewNotes
        }
      })

      if (error) throw error
      
      toast.success(data?.data?.message || 'Bulk action completed')
      setSelectedSubmissions([])
      setBulkAction('')
      setReviewNotes('')
      loadStagingSubmissions() // Reload data
    } catch (error) {
      console.error('Error processing bulk action:', error)
      toast.error('Failed to process bulk action')
    } finally {
      setProcessing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-700 bg-yellow-50">Pending</Badge>
      case 'invalid':
        return <Badge variant="destructive">Invalid</Badge>
      case 'flagged':
        return <Badge variant="secondary" className="text-orange-700 bg-orange-50">Flagged</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getReasonBadge = (reason: string) => {
    switch (reason) {
      case 'duplicate_detected':
        return <Badge variant="outline" className="text-purple-700 bg-purple-50">Duplicate</Badge>
      case 'validation_failed':
        return <Badge variant="outline" className="text-red-700 bg-red-50">Validation</Badge>
      case 'manual_review':
        return <Badge variant="outline" className="text-blue-700 bg-blue-50">Manual Review</Badge>
      default:
        return <Badge variant="outline">{reason}</Badge>
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize)
  const hasNextPage = currentPage < totalPages - 1
  const hasPrevPage = currentPage > 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading staged submissions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Staging Review - {formName}</h3>
          <p className="text-sm text-muted-foreground">
            Review submissions that require manual attention
          </p>
        </div>
        <Button variant="outline" onClick={loadStagingSubmissions}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{totalCount}</p>
                <p className="text-xs text-muted-foreground">Total Staged</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">
                  {submissions.filter(s => s.validation_status === 'flagged').length}
                </p>
                <p className="text-xs text-muted-foreground">Flagged</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-2xl font-bold">
                  {submissions.filter(s => s.validation_status === 'invalid').length}
                </p>
                <p className="text-xs text-muted-foreground">Invalid</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{selectedSubmissions.length}</p>
                <p className="text-xs text-muted-foreground">Selected</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Bulk Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Filter by Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="flagged">Flagged</SelectItem>
                  <SelectItem value="invalid">Invalid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Bulk Action</Label>
              <Select value={bulkAction} onValueChange={setBulkAction}>
                <SelectTrigger>
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approve">Approve Selected</SelectItem>
                  <SelectItem value="reject">Reject Selected</SelectItem>
                  <SelectItem value="edit_and_approve">Edit & Approve</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Review Notes</Label>
              <Input
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Optional notes..."
              />
            </div>
            
            <div className="flex items-end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    disabled={selectedSubmissions.length === 0 || !bulkAction || processing}
                    className="w-full"
                  >
                    {processing ? 'Processing...' : `Process ${selectedSubmissions.length} Selected`}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Bulk Action</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to {bulkAction} {selectedSubmissions.length} selected submissions?
                      {bulkAction === 'approve' && ' This will move them to the main submissions table.'}
                      {bulkAction === 'reject' && ' This will mark them as rejected and they won\'t be processed.'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={processBulkAction}>
                      Confirm {bulkAction}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submissions Table */}
      <Card>
        <CardContent>
          {submissions.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No staged submissions</h3>
              <p className="text-muted-foreground">All submissions are being processed normally</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedSubmissions.length === submissions.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Staged</TableHead>
                    <TableHead>Issues</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((submission) => (
                    <TableRow key={submission.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedSubmissions.includes(submission.id)}
                          onCheckedChange={() => handleSelectionToggle(submission.id)}
                        />
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(submission.validation_status)}
                      </TableCell>
                      <TableCell>
                        {getReasonBadge(submission.stage_reason)}
                      </TableCell>
                      <TableCell>
                        {submission.submitter_email ? (
                          <span className="text-sm">{submission.submitter_email}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Anonymous</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{formatDistanceToNow(new Date(submission.staged_at), { addSuffix: true })}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(submission.staged_at), 'MMM d, h:mm a')}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {submission.validation_errors && Object.keys(submission.validation_errors).length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {Object.keys(submission.validation_errors).length} validation errors
                            </Badge>
                          )}
                          {submission.duplicate_of && (
                            <Badge variant="outline" className="text-xs">
                              Duplicate detected
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedSubmission(submission)
                            setShowDetailDialog(true)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, totalCount)} of {totalCount} staged submissions
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={!hasPrevPage}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={!hasNextPage}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Staged Submission Details</DialogTitle>
          </DialogHeader>
          
          {selectedSubmission && (
            <Tabs defaultValue="data" className="w-full">
              <TabsList>
                <TabsTrigger value="data">Submission Data</TabsTrigger>
                <TabsTrigger value="issues">Issues</TabsTrigger>
                <TabsTrigger value="metadata">Metadata</TabsTrigger>
              </TabsList>
              
              <TabsContent value="data" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Form Answers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {Object.entries(selectedSubmission.submission_data).map(([key, value]) => (
                        <div key={key} className="flex justify-between py-1 border-b border-gray-100">
                          <span className="font-medium text-gray-600">{key}:</span>
                          <span className="text-right max-w-xs truncate">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="issues" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Validation Issues</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedSubmission.validation_errors && Object.keys(selectedSubmission.validation_errors).length > 0 ? (
                      <div className="space-y-2 text-sm">
                        {Object.entries(selectedSubmission.validation_errors).map(([field, error]) => (
                          <div key={field} className="p-2 bg-red-50 rounded border-l-4 border-red-500">
                            <div className="font-medium text-red-700">{field}</div>
                            <div className="text-red-600">{String(error)}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No validation errors found</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="metadata" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Submission Metadata</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div><strong>ID:</strong> {selectedSubmission.id}</div>
                    <div><strong>Status:</strong> {getStatusBadge(selectedSubmission.validation_status)}</div>
                    <div><strong>Reason:</strong> {getReasonBadge(selectedSubmission.stage_reason)}</div>
                    <div><strong>Staged:</strong> {format(new Date(selectedSubmission.staged_at), 'MMM d, yyyy h:mm a')}</div>
                    {selectedSubmission.submitter_email && (
                      <div><strong>Email:</strong> {selectedSubmission.submitter_email}</div>
                    )}
                    {selectedSubmission.duplicate_of && (
                      <div><strong>Duplicate of:</strong> {selectedSubmission.duplicate_of}</div>
                    )}
                    {selectedSubmission.reviewed_at && (
                      <div><strong>Reviewed:</strong> {format(new Date(selectedSubmission.reviewed_at), 'MMM d, yyyy h:mm a')}</div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}