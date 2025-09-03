// src/features/sheets/components/ColumnHeader.tsx

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Edit, Settings, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// Define the props this component will receive from AG Grid
export interface ColumnHeaderProps {
  displayName: string;
  onEdit: () => void;
  // We'll add onDelete later when the logic is extracted
}

export function ColumnHeader({ displayName, onEdit }: ColumnHeaderProps) {
  const handleDelete = () => {
    toast.error('Delete column functionality will be implemented in a later phase.');
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="flex items-center justify-between w-full h-full group ag-header-group-cell-label">
          <span className="flex-1 truncate">{displayName}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Settings className="h-3 w-3" />
          </Button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={onEdit} className="cursor-pointer">
          <Edit className="h-4 w-4 mr-2" />
          Edit Column Settings
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={handleDelete}
          className="cursor-pointer text-red-600 focus:text-red-600"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Column
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}