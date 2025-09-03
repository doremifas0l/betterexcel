import React from 'react'
import { 
  Maximize2, 
  Minimize2, 
  Plus, 
  Settings, 
  Download, 
  Upload, 
  Printer,
  Copy,
  Scissors,
  FileText,
  Save
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useFullscreen } from '@/context/FullscreenContext'
import { cn } from '@/lib/utils'

interface ExcelToolbarProps {
  onAddColumn?: () => void
  onSheetSettings?: () => void
  onSave?: () => void
  className?: string
}

export function ExcelToolbar({ 
  onAddColumn, 
  onSheetSettings, 
  onSave,
  className 
}: ExcelToolbarProps) {
  const { isFullscreen, toggleFullscreen } = useFullscreen()

  const ToolbarButton = ({ icon: Icon, tooltip, onClick, disabled = false }: {
    icon: React.ElementType
    tooltip: string
    onClick?: () => void
    disabled?: boolean
  }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            disabled={disabled}
            className={cn(
              "excel-toolbar-button",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )

  return (
    <div className={cn("excel-toolbar", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {/* File Operations */}
          <div className="excel-toolbar-section">
            <ToolbarButton 
              icon={Save} 
              tooltip="Save (Ctrl+S)" 
              onClick={onSave}
            />
            <ToolbarButton 
              icon={Download} 
              tooltip="Export" 
              onClick={() => console.log('Export')}
            />
            <ToolbarButton 
              icon={Upload} 
              tooltip="Import" 
              onClick={() => console.log('Import')}
            />
            <ToolbarButton 
              icon={Printer} 
              tooltip="Print" 
              onClick={() => window.print()}
            />
          </div>

          {/* Edit Operations */}
          <div className="excel-toolbar-section">
            <ToolbarButton 
              icon={Copy} 
              tooltip="Copy (Ctrl+C)" 
              onClick={() => document.execCommand('copy')}
            />
            <ToolbarButton 
              icon={Scissors} 
              tooltip="Cut (Ctrl+X)" 
              onClick={() => document.execCommand('cut')}
            />
            <ToolbarButton 
              icon={FileText} 
              tooltip="Paste (Ctrl+V)" 
              onClick={() => document.execCommand('paste')}
            />
          </div>

          {/* Column Operations */}
          <div className="excel-toolbar-section">
            <ToolbarButton 
              icon={Plus} 
              tooltip="Add Column" 
              onClick={onAddColumn}
            />
            <ToolbarButton 
              icon={Settings} 
              tooltip="Sheet Settings" 
              onClick={onSheetSettings}
            />
          </div>
        </div>

        {/* View Controls */}
        <div className="excel-toolbar-section">
          <ToolbarButton 
            icon={isFullscreen ? Minimize2 : Maximize2} 
            tooltip={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"} 
            onClick={toggleFullscreen}
          />
        </div>
      </div>
    </div>
  )
}
