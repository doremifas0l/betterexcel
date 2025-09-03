import React, { useState, useRef } from 'react'
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  WrapText,
  Indent,
  Outdent,
  List,
  ListOrdered,
  Palette,
  Type,
  ChevronDown,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  CellFormatting,
  FONT_FAMILIES,
  FONT_SIZES,
  EXCEL_COLORS,
  DEFAULT_CELL_FORMATTING
} from '@/lib/formatting'

interface FormattingToolbarProps {
  selectedFormatting?: CellFormatting
  onFormattingChange: (formatting: Partial<CellFormatting>) => void
  className?: string
}

export function FormattingToolbar({
  selectedFormatting = DEFAULT_CELL_FORMATTING,
  onFormattingChange,
  className
}: FormattingToolbarProps) {
  const [showTextColorPicker, setShowTextColorPicker] = useState(false)
  const [showBackgroundColorPicker, setShowBackgroundColorPicker] = useState(false)

  const ColorPicker = ({
    selectedColor,
    onColorSelect,
    onClose
  }: {
    selectedColor: string
    onColorSelect: (color: string) => void
    onClose: () => void
  }) => (
    <div className="w-64 p-4 bg-white rounded-lg shadow-lg border">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-900">Colors</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-6 w-6 text-gray-500 hover:text-gray-700"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Automatic and No Fill options */}
      <div className="mb-3">
        <button
          onClick={() => {
            onColorSelect('transparent')
            onClose()
          }}
          className="w-full p-2 text-left text-sm hover:bg-gray-100 rounded flex items-center gap-2"
        >
          <div className="w-4 h-4 border border-gray-300 bg-white"></div>
          No Fill
        </button>
        <button
          onClick={() => {
            onColorSelect('#000000')
            onClose()
          }}
          className="w-full p-2 text-left text-sm hover:bg-gray-100 rounded flex items-center gap-2"
        >
          <div className="w-4 h-4 bg-black"></div>
          Automatic
        </button>
      </div>
      
      {/* Standard colors */}
      <div className="mb-3">
        <p className="text-xs font-medium text-gray-600 mb-2">Standard Colors</p>
        <div className="grid grid-cols-10 gap-1">
          {EXCEL_COLORS.standard.map((color) => (
            <button
              key={color}
              onClick={() => {
                onColorSelect(color)
                onClose()
              }}
              className={cn(
                "w-5 h-5 rounded border hover:scale-110 transition-transform",
                selectedColor === color && "ring-2 ring-blue-500 ring-offset-1"
              )}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </div>
      
      {/* Theme colors */}
      <div className="mb-3">
        <p className="text-xs font-medium text-gray-600 mb-2">Theme Colors</p>
        <div className="grid grid-cols-10 gap-1">
          {EXCEL_COLORS.themeLight.map((color) => (
            <button
              key={color}
              onClick={() => {
                onColorSelect(color)
                onClose()
              }}
              className={cn(
                "w-5 h-5 rounded border hover:scale-110 transition-transform",
                selectedColor === color && "ring-2 ring-blue-500 ring-offset-1"
              )}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </div>
      
      {/* Extended colors */}
      <div>
        <p className="text-xs font-medium text-gray-600 mb-2">More Colors</p>
        <div className="grid grid-cols-7 gap-1">
          {EXCEL_COLORS.extended.map((color) => (
            <button
              key={color}
              onClick={() => {
                onColorSelect(color)
                onClose()
              }}
              className={cn(
                "w-5 h-5 rounded border hover:scale-110 transition-transform",
                selectedColor === color && "ring-2 ring-blue-500 ring-offset-1"
              )}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </div>
    </div>
  )

  const ToolbarButton = ({
    icon: Icon,
    tooltip,
    onClick,
    isActive = false,
    disabled = false
  }: {
    icon: React.ElementType
    tooltip: string
    onClick: () => void
    isActive?: boolean
    disabled?: boolean
  }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClick}
            disabled={disabled}
            className={cn(
              "h-8 w-8 p-0 hover:bg-gray-100",
              isActive && "bg-blue-100 text-blue-600 hover:bg-blue-200"
            )}
          >
            <Icon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )

  const ColorButton = ({
    icon: Icon,
    tooltip,
    selectedColor,
    onColorSelect,
    isOpen,
    onOpenChange
  }: {
    icon: React.ElementType
    tooltip: string
    selectedColor: string
    onColorSelect: (color: string) => void
    isOpen: boolean
    onOpenChange: (open: boolean) => void
  }) => (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <div className="relative">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-gray-100 relative"
                >
                  <Icon className="h-4 w-4" />
                  <div
                    className="absolute bottom-0 left-1 right-1 h-1 rounded-sm"
                    style={{ backgroundColor: selectedColor }}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-3 p-0 absolute -right-1 -top-1 hover:bg-gray-100"
          >
            <ChevronDown className="h-2 w-2" />
          </Button>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <ColorPicker
          selectedColor={selectedColor}
          onColorSelect={onColorSelect}
          onClose={() => onOpenChange(false)}
        />
      </PopoverContent>
    </Popover>
  )

  return (
    <div className={cn("flex items-center gap-1 p-2 bg-white border-b border-gray-200", className)}>
      {/* Font Family */}
      <div className="flex items-center gap-1 pr-2 border-r border-gray-200">
        <Select
          value={selectedFormatting.fontFamily}
          onValueChange={(value) => onFormattingChange({ fontFamily: value })}
        >
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="Font" />
          </SelectTrigger>
          <SelectContent>
            {FONT_FAMILIES.map((font) => (
              <SelectItem key={font.value} value={font.value} className="text-xs">
                <span style={{ fontFamily: font.value }}>{font.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Font Size */}
        <Select
          value={selectedFormatting.fontSize?.toString()}
          onValueChange={(value) => onFormattingChange({ fontSize: parseInt(value) })}
        >
          <SelectTrigger className="w-16 h-8 text-xs">
            <SelectValue placeholder="Size" />
          </SelectTrigger>
          <SelectContent>
            {FONT_SIZES.map((size) => (
              <SelectItem key={size} value={size.toString()} className="text-xs">
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Text Styling */}
      <div className="flex items-center gap-1 pr-2 border-r border-gray-200">
        <ToolbarButton
          icon={Bold}
          tooltip="Bold (Ctrl+B)"
          onClick={() => onFormattingChange({
            fontWeight: selectedFormatting.fontWeight === 'bold' ? 'normal' : 'bold'
          })}
          isActive={selectedFormatting.fontWeight === 'bold'}
        />
        <ToolbarButton
          icon={Italic}
          tooltip="Italic (Ctrl+I)"
          onClick={() => onFormattingChange({
            fontStyle: selectedFormatting.fontStyle === 'italic' ? 'normal' : 'italic'
          })}
          isActive={selectedFormatting.fontStyle === 'italic'}
        />
        <ToolbarButton
          icon={Underline}
          tooltip="Underline (Ctrl+U)"
          onClick={() => onFormattingChange({
            textDecoration: selectedFormatting.textDecoration === 'underline' ? 'none' : 'underline'
          })}
          isActive={selectedFormatting.textDecoration === 'underline'}
        />
      </div>

      {/* Colors */}
      <div className="flex items-center gap-1 pr-2 border-r border-gray-200">
        <ColorButton
          icon={Type}
          tooltip="Text Color"
          selectedColor={selectedFormatting.textColor || '#000000'}
          onColorSelect={(color) => onFormattingChange({ textColor: color })}
          isOpen={showTextColorPicker}
          onOpenChange={setShowTextColorPicker}
        />
        <ColorButton
          icon={Palette}
          tooltip="Background Color"
          selectedColor={selectedFormatting.backgroundColor || '#FFFFFF'}
          onColorSelect={(color) => onFormattingChange({ backgroundColor: color })}
          isOpen={showBackgroundColorPicker}
          onOpenChange={setShowBackgroundColorPicker}
        />
      </div>

      {/* Text Alignment */}
      <div className="flex items-center gap-1 pr-2 border-r border-gray-200">
        <ToolbarButton
          icon={AlignLeft}
          tooltip="Align Left"
          onClick={() => onFormattingChange({ textAlign: 'left' })}
          isActive={selectedFormatting.textAlign === 'left'}
        />
        <ToolbarButton
          icon={AlignCenter}
          tooltip="Center"
          onClick={() => onFormattingChange({ textAlign: 'center' })}
          isActive={selectedFormatting.textAlign === 'center'}
        />
        <ToolbarButton
          icon={AlignRight}
          tooltip="Align Right"
          onClick={() => onFormattingChange({ textAlign: 'right' })}
          isActive={selectedFormatting.textAlign === 'right'}
        />
        <ToolbarButton
          icon={AlignJustify}
          tooltip="Justify"
          onClick={() => onFormattingChange({ textAlign: 'justify' })}
          isActive={selectedFormatting.textAlign === 'justify'}
        />
      </div>

      {/* Text Options */}
      <div className="flex items-center gap-1 pr-2 border-r border-gray-200">
        <ToolbarButton
          icon={WrapText}
          tooltip="Wrap Text"
          onClick={() => onFormattingChange({ textWrap: !selectedFormatting.textWrap })}
          isActive={selectedFormatting.textWrap}
        />
        <ToolbarButton
          icon={Outdent}
          tooltip="Decrease Indent"
          onClick={() => onFormattingChange({
            textIndent: Math.max(0, (selectedFormatting.textIndent || 0) - 10)
          })}
        />
        <ToolbarButton
          icon={Indent}
          tooltip="Increase Indent"
          onClick={() => onFormattingChange({
            textIndent: (selectedFormatting.textIndent || 0) + 10
          })}
        />
      </div>

      {/* List Options */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          icon={List}
          tooltip="Bullet List"
          onClick={() => onFormattingChange({
            listStyle: selectedFormatting.listStyle === 'bullet' ? 'none' : 'bullet'
          })}
          isActive={selectedFormatting.listStyle === 'bullet'}
        />
        <ToolbarButton
          icon={ListOrdered}
          tooltip="Numbered List"
          onClick={() => onFormattingChange({
            listStyle: selectedFormatting.listStyle === 'numbered' ? 'none' : 'numbered'
          })}
          isActive={selectedFormatting.listStyle === 'numbered'}
        />
      </div>
    </div>
  )
}
