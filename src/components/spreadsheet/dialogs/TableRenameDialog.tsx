import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { BetterTable } from '@/lib/supabase'
import { toast } from 'sonner'
import { Edit } from 'lucide-react'

interface TableRenameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  table: BetterTable | null
  onRename: (tableId: string, name: string, description?: string) => Promise<boolean>
}

export function TableRenameDialog({
  open,
  onOpenChange,
  table,
  onRename
}: TableRenameDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)

  useEffect(() => {
    if (table && open) {
      setName(table.name)
      setDescription(table.description || '')
    }
  }, [table, open])

  const handleRename = async () => {
    if (!table || !name.trim()) {
      toast.error('Table name is required')
      return
    }

    if (name.trim() === table.name && description.trim() === (table.description || '')) {
      onOpenChange(false)
      return
    }

    setIsRenaming(true)
    try {
      const success = await onRename(
        table.id, 
        name.trim(), 
        description.trim() || undefined
      )
      
      if (success) {
        onOpenChange(false)
      }
    } finally {
      setIsRenaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleRename()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Rename Table
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="tableName">Table Name *</Label>
            <Input
              id="tableName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter table name"
              autoFocus
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="tableDescription">Description</Label>
            <Textarea
              id="tableDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleRename} 
            disabled={isRenaming || !name.trim()}
          >
            {isRenaming ? 'Renaming...' : 'Rename Table'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}