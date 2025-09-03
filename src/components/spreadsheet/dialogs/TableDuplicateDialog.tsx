import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BetterTable } from '@/lib/supabase'
import { toast } from 'sonner'
import { Copy, Table2 } from 'lucide-react'

interface TableDuplicateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  table: BetterTable | null
  onDuplicate: (tableId: string, newName: string, description?: string, copyData?: boolean) => Promise<boolean>
}

export function TableDuplicateDialog({
  open,
  onOpenChange,
  table,
  onDuplicate
}: TableDuplicateDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [copyData, setCopyData] = useState(false)
  const [isDuplicating, setIsDuplicating] = useState(false)

  React.useEffect(() => {
    if (table && open) {
      setName(`${table.name} (Copy)`)
      setDescription(table.description || '')
      setCopyData(false)
    }
  }, [table, open])

  const handleDuplicate = async () => {
    if (!table || !name.trim()) {
      toast.error('Table name is required')
      return
    }

    setIsDuplicating(true)
    try {
      const success = await onDuplicate(
        table.id,
        name.trim(),
        description.trim() || undefined,
        copyData
      )
      
      if (success) {
        onOpenChange(false)
      }
    } finally {
      setIsDuplicating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleDuplicate()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Duplicate Table
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Source Table Info */}
          {table && (
            <Card className="bg-gray-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Table2 className="h-4 w-4" />
                  Source Table
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  <div className="font-medium">{table.name}</div>
                  <div className="text-gray-600 mt-1">
                    {table.row_count || 0} rows
                    {table.description && (
                      <span> • {table.description}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* New Table Configuration */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tableName">New Table Name *</Label>
              <Input
                id="tableName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter new table name"
                autoFocus
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tableDescription">Description</Label>
              <Textarea
                id="tableDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description for the new table"
                rows={2}
              />
            </div>
            
            <div className="space-y-3">
              <Label className="text-base font-medium">Duplication Options</Label>
              <div className="flex items-start space-x-3 p-3 rounded-lg border">
                <Checkbox
                  id="copyData"
                  checked={copyData}
                  onCheckedChange={(checked) => setCopyData(checked as boolean)}
                />
                <div className="space-y-1">
                  <Label htmlFor="copyData" className="text-sm font-medium cursor-pointer">
                    Copy existing data
                  </Label>
                  <p className="text-xs text-gray-600">
                    Include all rows and data from the original table. 
                    If unchecked, only the table structure (columns and settings) will be copied.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleDuplicate} 
            disabled={isDuplicating || !name.trim()}
          >
            {isDuplicating ? (
              copyData ? 'Duplicating with data...' : 'Duplicating structure...'
            ) : (
              'Duplicate Table'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}