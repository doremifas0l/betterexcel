import React from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Edit, Copy, Trash2, Crown } from 'lucide-react'
import { BetterTable } from '@/lib/supabase'

interface TableActionsMenuProps {
  table: BetterTable
  onRename: (table: BetterTable) => void
  onDuplicate: (table: BetterTable) => void
  onDelete: (table: BetterTable) => void
  onSetPrimary: (table: BetterTable) => void
}

export function TableActionsMenu({
  table,
  onRename,
  onDuplicate,
  onDelete,
  onSetPrimary,
}: TableActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          // This is critical: it stops the click from bubbling up to the navigation div
          onClick={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 w-6 h-6"
          aria-label="Table options"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="start" 
        // Also stop propagation here to be safe
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuLabel>{table.name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onRename(table)}>
          <Edit className="mr-2 h-4 w-4" />
          <span>Rename</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDuplicate(table)}>
          <Copy className="mr-2 h-4 w-4" />
          <span>Duplicate</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSetPrimary(table)}>
          <Crown className="mr-2 h-4 w-4" />
          <span>Set Primary Column</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          className="text-red-600 focus:text-red-600 focus:bg-red-50"
          onClick={() => onDelete(table)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          <span>Delete Table</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}