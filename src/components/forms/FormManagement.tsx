import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Eye, Share, Download, Trash2, Calendar, Mail, User, Database, ExternalLink, Filter, Search, RefreshCw, MoreHorizontal, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { FormSharingDialog } from '@/components/FormSharingDialog'
import { toast } from 'sonner'
import { formatDistanceToNow, format } from 'date-fns'

interface FormSubmission {
  id: string
  submitted_by?: string
  submitter_email?: string
  processing_status: 'processing' | 'completed' | 'failed'
  created_at: string
  processed_at?: string
  is_public_submission: boolean
  created_records: any
}

interface FormManagementProps {
  formId: string
  formName: string
  onBack?: () => void
}

export function FormManagement({ formId, formName, onBack }: FormManagementProps) {
  const { user } = useAuth()
  
  const [loading, setLoading] = useState(true)
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null)
  const [submissionDetails, setSubmissionDetails] = useState<any>(null)
  const [crossTableData, setCrossTableData] = useState<any>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [showCrossTableDialog, setShowCrossTableDialog] = useState(false)
  
  // Pagination and filters
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize] = useState(20)
  const [totalCount, setTotalCount] = useState(0)
  const [filters, setFilters] = useState({
    status: 'all-statuses',
    is_public_submission: 'all-types',
    date_from: '',
    date_to: '',
    search: ''
  })
  
  useEffect(() => {
    loadSubmissions()
  }, [formId, currentPage, filters])

  const loadSubmissions = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('forms-manage', {
        body: {
          action: 'list_submissions',
          form_id: formId,
          limit: pageSize,
          offset: currentPage * pageSize,
          filters: {
            ...filters,
            is_public_submission: filters.is_public_submission === 'all-types' ? undefined : filters.is_public_submission === 'true'
          }
        }
      })

      if (error) throw error
      if (data?.data) {
        setSubmissions(data.data.submissions)
        setTotalCount(data.data.pagination.total)
      }
    } catch (error) {
      console.error('Error loading submissions:', error)
      toast.error('Failed to load submissions')
    } finally {
      setLoading(false)
    }
  }

  const loadSubmissionDetails = async (submission: FormSubmission) => {
    try {
      const { data, error } = await supabase.functions.invoke('forms-manage', {
        body: {
          action: 'get_submission_details',
          submission_id: submission.id
        }
      })

      if (error) throw error
      if (data?.data) {
        setSubmissionDetails(data.data)
        setSelectedSubmission(submission)
        setShowDetailsDialog(true)
      }
    } catch (error) {
      console.error('Error loading submission details:', error)
      toast.error('Failed to load submission details')
    }
  }

  const loadCrossTableData = async (submission: FormSubmission) => {
    try {
      const { data, error } = await supabase.functions.invoke('forms-manage', {
        body: {
          action: 'get_cross_table_data',
          submission_id: submission.id
        }
      })

      if (error) throw error
      if (data?.data) {
        setCrossTableData(data.data)
        setSelectedSubmission(submission)
        setShowCrossTableDialog(true)
      }
    } catch (error) {
      console.error('Error loading cross-table data:', error)
      toast.error('Failed to load distributed data')
    }
  }

  const deleteSubmission = async (submissionId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('forms-manage', {
        body: {
          action: 'delete_submission',
          submission_id: submissionId
        }
      })

      if (error) throw error
      toast.success('Submission deleted successfully')
      loadSubmissions() // Reload the list
    } catch (error) {
      console.error('Error deleting submission:', error)
      toast.error('Failed to delete submission')
    }
  }

  const exportSubmissions = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('forms-manage', {
        body: {
          action: 'export_submissions',
          form_id: formId,
          filters: {
            ...filters,
            is_public_submission: filters.is_public_submission === 'all-types' ? undefined : filters.is_public_submission === 'true'
          }
        }
      })

      if (error) throw error
      if (data?.data) {
        // Create and download file
        const blob = new Blob([JSON.stringify(data.data, null, 2)], {
          type: 'application/json'
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${formName}-submissions-${format(new Date(), 'yyyy-MM-dd')}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        toast.success('Submissions exported successfully')
      }
    } catch (error) {
      console.error('Error exporting submissions:', error)
      toast.error('Failed to export submissions')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>
      case 'processing':
        return <Badge className="bg-yellow-100 text-yellow-800">Processing</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const resetFilters = () => {
    setFilters({
      status: 'all-statuses',
      is_public_submission: 'all-types',
      date_from: '',
      date_to: '',
      search: ''
    })
    setCurrentPage(0)
  }

  const totalPages = Math.ceil(totalCount / pageSize)
  const hasNextPage = currentPage < totalPages - 1
  const hasPrevPage = currentPage > 0

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button 
          onClick={onBack}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Forms
        </button>
        <span>/</span>
        <span className="text-foreground">{formName} Submissions</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{formName} - Submissions</h2>
          <p className="text-muted-foreground">
            Manage and view form submissions distributed across multiple tables
          </p>
        </div>
        <div className="flex gap-2">
          <FormSharingDialog formId={formId} formName={formName}>
            <Button variant="outline">
              <Share className="h-4 w-4 mr-2" />
              Share Form
            </Button>
          </FormSharingDialog>
          <Button variant="outline" onClick={exportSubmissions}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={onBack} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Forms
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-statuses">All statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="type-filter">Submission Type</Label>
              <Select value={filters.is_public_submission} onValueChange={(value) => setFilters({ ...filters, is_public_submission: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-types">All types</SelectItem>
                  <SelectItem value="true">Public</SelectItem>
                  <SelectItem value="false">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="date-from">From Date</Label>
              <Input
                id="date-from"
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="date-to">To Date</Label>
              <Input
                id="date-to"
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              />
            </div>
            
            <div className="flex items-end">
              <Button onClick={resetFilters} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
            
            <div className="flex items-end">
              <Button onClick={loadSubmissions}>
                <Search className="h-4 w-4 mr-2" />
                Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submissions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Submissions ({totalCount})</CardTitle>
            <Button variant="outline" size="sm" onClick={loadSubmissions}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading submissions...</p>
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No submissions yet</h3>
              <p className="text-muted-foreground">Submissions will appear here once users fill out your form</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Tables</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((submission) => (
                    <TableRow key={submission.id}>
                      <TableCell>
                        {getStatusBadge(submission.processing_status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <div>
                            <div className="text-sm font-medium">
                              {formatDistanceToNow(new Date(submission.created_at), { addSuffix: true })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(submission.created_at), 'MMM d, yyyy h:mm a')}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={submission.is_public_submission ? "default" : "secondary"}>
                          {submission.is_public_submission ? 'Public' : 'Private'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {submission.submitter_email ? (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            <span className="text-sm">{submission.submitter_email}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No email</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {Object.keys(submission.created_records || {}).length} tables
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => loadSubmissionDetails(submission)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => loadCrossTableData(submission)}
                            title="View Cross-Table Data"
                            disabled={!submission.created_records || Object.keys(submission.created_records).length === 0}
                          >
                            <Database className="h-4 w-4" />
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" title="Delete Submission">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Submission</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this submission? This will remove the submission record but NOT the data that was created in your tables.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteSubmission(submission.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, totalCount)} of {totalCount} submissions
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

      {/* Submission Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submission Details</DialogTitle>
          </DialogHeader>
          
          {submissionDetails && (
            <Tabs defaultValue="submission" className="w-full">
              <TabsList>
                <TabsTrigger value="submission">Submission Data</TabsTrigger>
                <TabsTrigger value="processing">Processing Log</TabsTrigger>
              </TabsList>
              
              <TabsContent value="submission" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Metadata</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div><strong>ID:</strong> {submissionDetails.submission.id}</div>
                      <div><strong>Status:</strong> {getStatusBadge(submissionDetails.submission.processing_status)}</div>
                      <div><strong>Submitted:</strong> {format(new Date(submissionDetails.submission.created_at), 'MMM d, yyyy h:mm a')}</div>
                      {submissionDetails.submission.processed_at && (
                        <div><strong>Processed:</strong> {format(new Date(submissionDetails.submission.processed_at), 'MMM d, yyyy h:mm a')}</div>
                      )}
                      <div><strong>Type:</strong> {submissionDetails.submission.is_public_submission ? 'Public' : 'Private'}</div>
                      {submissionDetails.submission.submitter_email && (
                        <div><strong>Email:</strong> {submissionDetails.submission.submitter_email}</div>
                      )}
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Form Answers</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {Object.entries(submissionDetails.submission.submission_data || {}).map(([questionId, answer]) => (
                          <div key={questionId} className="p-2 bg-gray-50 rounded">
                            <div className="text-sm font-medium">Question ID: {questionId}</div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {typeof answer === 'object' ? JSON.stringify(answer) : answer?.toString() || 'No answer'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              <TabsContent value="processing" className="space-y-4">
                {submissionDetails.processing_log?.length > 0 ? (
                  <div className="space-y-2">
                    {submissionDetails.processing_log.map((log: any, index: number) => (
                      <Card key={index}>
                        <CardContent className="pt-4">
                          <div className="text-sm">
                            <div className="font-medium mb-2">Processing Step {index + 1}</div>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div><strong>Status:</strong> {log.processing_status}</div>
                              <div><strong>Details:</strong> {JSON.stringify(log.processing_details)}</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No processing log available
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Cross-Table Data Dialog */}
      <Dialog open={showCrossTableDialog} onOpenChange={setShowCrossTableDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cross-Table Distributed Data</DialogTitle>
          </DialogHeader>
          
          {crossTableData && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This submission created data across {Object.keys(crossTableData.cross_table_data).length} different tables.
              </p>
              
              {Object.entries(crossTableData.cross_table_data).map(([tableId, tableData]: [string, any]) => (
                <Card key={tableId}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Table: {tableData.table_name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="current">
                      <TabsList>
                        <TabsTrigger value="current">Current Data</TabsTrigger>
                        <TabsTrigger value="original">Original Submission</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="current" className="mt-4">
                        <div className="bg-gray-50 p-4 rounded text-sm font-mono">
                          <pre>{JSON.stringify(tableData.current_data, null, 2)}</pre>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="original" className="mt-4">
                        <div className="bg-gray-50 p-4 rounded text-sm font-mono">
                          <pre>{JSON.stringify(tableData.original_data, null, 2)}</pre>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}