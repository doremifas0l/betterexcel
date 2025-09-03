import React, { useState, useEffect, useRef } from 'react'
import { Calculator, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { FormulaEngine } from '@/lib/formatting'

interface FormulaBarProps {
  selectedCell?: {
    cellId: string
    value: any
    formula?: string
  }
  onFormulaChange: (cellId: string, formula: string, value: any) => void
  cellData?: Record<string, any>
  className?: string
  isReadOnly?: boolean
}

export function FormulaBar({
  selectedCell,
  onFormulaChange,
  cellData = {},
  className,
  isReadOnly = false
}: FormulaBarProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [formulaText, setFormulaText] = useState('')
  const [calculatedValue, setCalculatedValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Update formula text when selected cell changes
  useEffect(() => {
    if (selectedCell) {
      const displayText = selectedCell.formula || selectedCell.value?.toString() || ''
      setFormulaText(displayText)
      
      // If it's a formula, calculate the preview
      if (FormulaEngine.isFormula(displayText)) {
        const { result } = FormulaEngine.parseFormula(displayText, cellData)
        setCalculatedValue(`= ${result}`)
      } else {
        setCalculatedValue('')
      }
    } else {
      setFormulaText('')
      setCalculatedValue('')
    }
  }, [selectedCell, cellData])

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleStartEdit = () => {
    if (!isReadOnly && selectedCell) {
      setIsEditing(true)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    // Reset to original value
    if (selectedCell) {
      const originalText = selectedCell.formula || selectedCell.value?.toString() || ''
      setFormulaText(originalText)
    }
  }

  const handleConfirmEdit = () => {
    if (!selectedCell) return

    let finalValue = formulaText
    
    // If it's a formula, calculate the result
    if (FormulaEngine.isFormula(formulaText)) {
      const { result } = FormulaEngine.parseFormula(formulaText, cellData)
      finalValue = result
    }

    onFormulaChange(selectedCell.cellId, formulaText, finalValue)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleConfirmEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelEdit()
    }
  }

  const handleFormulaTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value
    setFormulaText(newText)
    
    // Real-time calculation preview for formulas
    if (FormulaEngine.isFormula(newText)) {
      try {
        const { result } = FormulaEngine.parseFormula(newText, cellData)
        setCalculatedValue(`= ${result}`)
      } catch (error) {
        setCalculatedValue('= #ERROR!')
      }
    } else {
      setCalculatedValue('')
    }
  }

  return (
    <div className={cn("flex items-center bg-white border-b border-gray-200 px-2 py-1", className)}>
      {/* Cell Reference Display */}
      <div className="flex items-center gap-2 pr-3 border-r border-gray-200 min-w-[100px]">
        <div className="bg-gray-100 px-3 py-1 rounded text-sm font-medium text-gray-700 min-w-[60px] text-center">
          {selectedCell?.cellId || '—'}
        </div>
      </div>

      {/* Function Button */}
      <div className="px-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-gray-600 hover:text-gray-800 hover:bg-gray-100"
                onClick={() => {
                  if (!isEditing && selectedCell) {
                    setFormulaText('=')
                    setIsEditing(true)
                  }
                }}
                disabled={isReadOnly || !selectedCell}
              >
                <Calculator className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Insert Function</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Formula Input Area */}
      <div className="flex-1 flex items-center relative">
        {isEditing ? (
          <div className="flex items-center w-full gap-2">
            <Input
              ref={inputRef}
              value={formulaText}
              onChange={handleFormulaTextChange}
              onKeyDown={handleKeyDown}
              className="flex-1 h-7 text-sm border-none shadow-none focus:ring-1 focus:ring-blue-500 px-2"
              placeholder="Enter value or formula (e.g., =A1+B1, =SUM(A1:A10))"
            />
            
            {/* Edit Controls */}
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelEdit}
                      className="h-6 w-6 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Cancel (Esc)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleConfirmEdit}
                      className="h-6 w-6 p-0 text-gray-500 hover:text-green-600 hover:bg-green-50"
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Confirm (Enter)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        ) : (
          <div
            onClick={handleStartEdit}
            className={cn(
              "flex-1 h-7 px-2 py-1 text-sm bg-transparent cursor-text flex items-center",
              "hover:bg-gray-50 rounded transition-colors",
              isReadOnly && "cursor-not-allowed",
              !selectedCell && "text-gray-400"
            )}
          >
            <span className="flex-1 truncate">
              {selectedCell ? formulaText || 'Click to edit...' : 'Select a cell to edit'}
            </span>
            
            {/* Formula Preview */}
            {calculatedValue && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded ml-2">
                {calculatedValue}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Formula Help */}
      <div className="pl-3 border-l border-gray-200">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-xs text-gray-500 cursor-help px-2">
                fx
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="text-xs space-y-1">
                <p><strong>Basic formulas:</strong></p>
                <p>=A1+B1 (Addition)</p>
                <p>=A1*B1 (Multiplication)</p>
                <p>=SUM(A1:A10)</p>
                <p>=AVERAGE(A1:A10)</p>
                <p>=COUNT(A1:A10)</p>
                <p>=MIN(A1:A10)</p>
                <p>=MAX(A1:A10)</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}
