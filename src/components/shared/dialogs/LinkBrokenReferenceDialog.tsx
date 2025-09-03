import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Trash2, RefreshCw } from 'lucide-react'

interface LinkBrokenReferenceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  brokenReference: {
    rowId: string
    columnName: string
    linkedRowId: string
  } | null
  onRemoveLink: () => void
  onChooseNewLink: () => void
  onRestoreRecord?: () => void
}

export function LinkBrokenReferenceDialog({
  open,
  onOpenChange,
  brokenReference,
  onRemoveLink,
  onChooseNewLink,
  onRestoreRecord
}: LinkBrokenReferenceDialogProps) {
  if (!brokenReference) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Broken Reference
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">
              The link in column <strong>"{brokenReference.columnName}"</strong> points to a record 
              that no longer exists or has been deleted.
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium text-sm">What would you like to do?</h4>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• <strong>Remove Link:</strong> Clear the broken link from this cell</p>
              <p>• <strong>Choose New Link:</strong> Select a different record to link to</p>
              {onRestoreRecord && (
                <p>• <strong>Restore Record:</strong> Try to restore the deleted record (if possible)</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          
          <Button
            variant="destructive"
            onClick={() => {
              onRemoveLink()
              onOpenChange(false)
            }}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Remove Link
          </Button>
          
          <Button
            variant="outline"
            onClick={() => {
              onChooseNewLink()
              onOpenChange(false)
            }}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Choose New Link
          </Button>
          
          {onRestoreRecord && (
            <Button
              onClick={() => {
                onRestoreRecord()
                onOpenChange(false)
              }}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Restore Record
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

LinkBrokenReferenceDialog.displayName = 'LinkBrokenReferenceDialog'