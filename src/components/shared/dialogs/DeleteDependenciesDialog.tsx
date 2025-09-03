import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, ExternalLink, Trash2 } from 'lucide-react'

interface DeleteDependenciesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recordName: string
  dependencies: {
    tableName: string
    sheetName: string
    columnName: string
    count: number
  }[]
  onDeleteAnyway: () => void
  onViewDependencies?: () => void
}

export function DeleteDependenciesDialog({
  open,
  onOpenChange,
  recordName,
  dependencies,
  onDeleteAnyway,
  onViewDependencies
}: DeleteDependenciesDialogProps) {
  const totalDependentRecords = dependencies.reduce((sum, dep) => sum + dep.count, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Delete Warning - Record Has Dependencies
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              The record <strong>"{recordName}"</strong> is linked from {totalDependentRecords} other record(s) 
              across {dependencies.length} location(s). Deleting this record will create broken references.
            </p>
          </div>
          
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Dependent Records:</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {dependencies.map((dep, index) => (
                <Card key={index} className="bg-gray-50">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-sm">
                          <span className="font-medium">{dep.tableName}</span>
                          <span className="text-gray-500">•</span>
                          <span className="text-gray-600">{dep.sheetName}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          Column: <strong>{dep.columnName}</strong>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-red-600">
                          {dep.count} record{dep.count !== 1 ? 's' : ''}
                        </span>
                        {onViewDependencies && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={onViewDependencies}
                            className="h-6 px-2"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h5 className="font-medium text-red-800 mb-2">If you proceed with deletion:</h5>
            <ul className="text-sm text-red-700 space-y-1">
              <li>• All {totalDependentRecords} dependent record(s) will show "#REF" in their link cells</li>
              <li>• Users will need to manually fix or remove these broken references</li>
              <li>• Data integrity will be compromised until references are resolved</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel Delete
          </Button>
          
          {onViewDependencies && (
            <Button
              variant="outline"
              onClick={() => {
                onViewDependencies()
                onOpenChange(false)
              }}
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              View Dependencies
            </Button>
          )}
          
          <Button
            variant="destructive"
            onClick={() => {
              onDeleteAnyway()
              onOpenChange(false)
            }}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

DeleteDependenciesDialog.displayName = 'DeleteDependenciesDialog'