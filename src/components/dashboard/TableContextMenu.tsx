import React from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Edit, Trash2, Copy, Crown, Settings } from 'lucide-react'
import { BetterTable } from '@/lib/supabase'

interface TableContextMenuProps {
  table: BetterTable
  children: React.ReactNode
  onRename: (table: BetterTable) => void
  onDelete: (table: BetterTable) => void
  onDuplicate: (table: BetterTable) => void
  onSetPrimary?: (table: BetterTable) => void
  onTableSettings?: (table: BetterTable) => void
}

export function TableContextMenu({
  table,
  children,
  onRename,
  onDelete,
  onDuplicate,
  onSetPrimary,
  onTableSettings
}: TableContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={() => onRename(table)} className="cursor-pointer">
          <Edit className="h-4 w-4 mr-2" />
          Rename Table
        </ContextMenuItem>
        
        <ContextMenuItem onClick={() => onDuplicate(table)} className="cursor-pointer">
          <Copy className="h-4 w-4 mr-2" />
          Duplicate Table
        </ContextMenuItem>
        
        <ContextMenuSeparator />
        
        <ContextMenuItem onClick={() => onSetPrimary && onSetPrimary(table)} className="cursor-pointer">
          <Crown className="h-4 w-4 mr-2" />
          Manage Primary Column
        </ContextMenuItem>
        
        {onTableSettings && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onTableSettings(table)} className="cursor-pointer">
              <Settings className="h-4 w-4 mr-2" />
              Table Settings
            </ContextMenuItem>
          </>
        )}
        
        <ContextMenuSeparator />
        <ContextMenuItem 
          onClick={() => onDelete(table)} 
          className="cursor-pointer text-red-600 focus:text-red-600"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Table
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}