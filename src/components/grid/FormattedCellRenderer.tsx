import React, { useState, useEffect } from 'react'
import { ICellRendererParams } from 'ag-grid-community'
import {
  CellFormatting,
  FormattingUtils,
  FormulaEngine,
  DEFAULT_CELL_FORMATTING
} from '@/lib/formatting'
import { useFormatting } from '@/context/FormattingContext'
import { cn } from '@/lib/utils'

interface FormattedCellRendererProps extends ICellRendererParams {
  cellFormatting?: CellFormatting
  cellId?: string
  formula?: string
}

export function FormattedCellRenderer(params: FormattedCellRendererProps) {
  const { getCellDisplayValue, getFormatting } = useFormatting()
  const [displayValue, setDisplayValue] = useState(params.value)

  const cellId = params.cellId || FormattingUtils.getCellId(
    params.node?.rowIndex || 0,
    params.colDef?.field ? 
      (params.context?.columns?.findIndex((col: any) => col.id === params.colDef?.field) || 0) 
      : 0
  )

  const formatting = params.cellFormatting || getFormatting(cellId)
  const formula = params.formula

  useEffect(() => {
    if (formula && FormulaEngine.isFormula(formula)) {
      // Get calculated value for formula cells
      const calculatedValue = getCellDisplayValue(cellId, params.value, formula)
      setDisplayValue(calculatedValue)
    } else {
      setDisplayValue(params.value)
    }
  }, [params.value, formula, cellId, getCellDisplayValue])

  // Apply cell formatting styles
  const cellStyles = FormattingUtils.applyCellFormatting(formatting)
  
  // Handle list formatting
  const formatListContent = (content: string) => {
    if (!content || !formatting.listStyle || formatting.listStyle === 'none') {
      return content
    }

    const lines = content.split('\n').filter(line => line.trim())
    
    if (formatting.listStyle === 'bullet') {
      return lines.map((line, index) => (
        <div key={index} className="flex items-start gap-2">
          <span className="text-xs mt-1">•</span>
          <span>{line}</span>
        </div>
      ))
    }
    
    if (formatting.listStyle === 'numbered') {
      return lines.map((line, index) => (
        <div key={index} className="flex items-start gap-2">
          <span className="text-xs mt-1">{index + 1}.</span>
          <span>{line}</span>
        </div>
      ))
    }

    return content
  }

  // Format display value based on number format
  const formatDisplayValue = (value: any) => {
    if (value === null || value === undefined || value === '') {
      return ''
    }

    const stringValue = value.toString()
    
    switch (formatting.numberFormat) {
      case 'currency':
        const numValue = parseFloat(stringValue)
        return isNaN(numValue) ? stringValue : `$${numValue.toFixed(2)}`
      
      case 'percentage':
        const pctValue = parseFloat(stringValue)
        return isNaN(pctValue) ? stringValue : `${(pctValue * 100).toFixed(2)}%`
      
      case 'number':
        const numberValue = parseFloat(stringValue)
        return isNaN(numberValue) ? stringValue : numberValue.toLocaleString()
      
      case 'date':
        try {
          const dateValue = new Date(stringValue)
          return dateValue.toLocaleDateString()
        } catch {
          return stringValue
        }
      
      default:
        return stringValue
    }
  }

  const formattedContent = formatDisplayValue(displayValue)
  const isFormula = formula && FormulaEngine.isFormula(formula)

  return (
    <div
      className={cn(
        "h-full w-full flex items-center px-2 py-1 relative",
        "excel-formatted-cell",
        formatting.textWrap && "whitespace-pre-wrap overflow-hidden"
      )}
      style={{
        ...cellStyles,
        minHeight: '32px',
        lineHeight: formatting.textWrap ? '1.4' : '32px',
      }}
    >
      {/* Formula indicator */}
      {isFormula && (
        <div className="absolute top-1 left-1 w-2 h-2 bg-blue-500 rounded-full opacity-60" />
      )}
      
      {/* Cell content */}
      <div className="flex-1 overflow-hidden">
        {formatting.listStyle && formatting.listStyle !== 'none' ? (
          <div className="space-y-1">
            {formatListContent(formattedContent.toString())}
          </div>
        ) : (
          <span className="truncate">{formattedContent}</span>
        )}
      </div>
      
      {/* Error indicator for invalid formulas */}
      {isFormula && displayValue === '#ERROR!' && (
        <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
      )}
    </div>
  )
}

// Cell editor with formatting support
export function FormattedCellEditor(params: any) {
  const [value, setValue] = useState(params.value || '')
  const inputRef = React.useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (params.api) {
        params.api.stopEditing()
      }
    } else if (e.key === 'Escape') {
      if (params.api) {
        params.api.stopEditing(true) // Cancel editing
      }
    }
  }

  // Get value for AG Grid
  React.useImperativeHandle(params.eGridCell, () => {
    return {
      getValue() {
        return value
      },
      
      isCancelBeforeStart() {
        return false
      },
      
      isCancelAfterEnd() {
        return false
      }
    }
  })

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      className="w-full h-full px-2 border-0 outline-0 bg-white text-sm"
      style={{
        fontSize: '13px',
        fontFamily: 'inherit'
      }}
    />
  )
}
