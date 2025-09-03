import React, { useState } from 'react'
import { Plus, X, MoreHorizontal, Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { BetterSheet } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ExcelSheetTabsProps {
  sheets: BetterSheet[]
  activeSheetId: string | null
  onSheetSelect: (sheetId: string) => void
  onSheetCreate: () => void
  onSheetRename: (sheetId: string, newName: string) => void
  onSheetDelete: (sheet: BetterSheet) => void
  onSheetDuplicate?: (sheet: BetterSheet) => void
  isCreatingSheet?: boolean
  enhanced?: boolean
}

export function ExcelSheetTabs({
  sheets,
  activeSheetId,
  onSheetSelect,
  onSheetCreate,
  onSheetRename,
  onSheetDelete,
  onSheetDuplicate,
  isCreatingSheet = false,
  enhanced = false
}: ExcelSheetTabsProps) {
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const handleEditStart = (sheet: BetterSheet) => {
    setEditingSheetId(sheet.id)
    setEditingName(sheet.name)
  }

  const handleEditSave = async () => {
    if (!editingSheetId || !editingName.trim()) {
      toast.error('Sheet name is required')
      return
    }

    await onSheetRename(editingSheetId, editingName.trim())
    setEditingSheetId(null)
    setEditingName('')
  }

  const handleEditCancel = () => {
    setEditingSheetId(null)
    setEditingName('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEditSave()
    } else if (e.key === 'Escape') {
      handleEditCancel()
    }
  }

  return (
    <div className={cn(
      "flex items-center px-4 py-2",
      enhanced ? "enhanced-sheet-tabs" : "bg-gray-50 border-t border-gray-200"
    )}>
      {/* Sheet Tabs */}
      <div className="flex items-center space-x-1 flex-1 overflow-x-auto">
        {sheets.map((sheet) => (
          <div
            key={sheet.id}
            className={cn(
              "group relative flex items-center px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 cursor-pointer transition-all duration-200 min-w-[120px] max-w-[200px]",
              enhanced ? "enhanced-sheet-tab" : "",
              activeSheetId === sheet.id
                ? enhanced 
                  ? "enhanced-sheet-tab active"
                  : "bg-white text-gray-900 border-blue-500 shadow-sm"
                : enhanced
                  ? "enhanced-sheet-tab"
                  : "bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200 hover:text-gray-800"
            )}
            onClick={() => !editingSheetId && onSheetSelect(sheet.id)}
          >
            {editingSheetId === sheet.id ? (
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleEditSave}
                className="h-6 p-1 text-sm border-none bg-transparent focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            ) : (
              <>
                <span className="truncate flex-1">{sheet.name}</span>
                
                {/* Sheet Actions Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 ml-2 opacity-0 group-hover:opacity-100 transition-opacity p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                      }}
                    >
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-40">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditStart(sheet)
                      }}
                      className="cursor-pointer"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Rename
                    </DropdownMenuItem>
                    {onSheetDuplicate && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          onSheetDuplicate(sheet)
                        }}
                        className="cursor-pointer"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        onSheetDelete(sheet)
                      }}
                      className="cursor-pointer text-red-600 focus:text-red-600"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        ))}
        
        {/* Add New Sheet Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onSheetCreate}
          disabled={isCreatingSheet}
          className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full ml-2"
          title="Add new sheet"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Sheet Navigation Info */}
      <div className="text-xs text-gray-500 ml-4">
        {sheets.length} sheet{sheets.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}