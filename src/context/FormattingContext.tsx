import React, { createContext, useContext, useState, useCallback } from 'react'
import {
  CellFormatting,
  FormattedRowData,
  DEFAULT_CELL_FORMATTING,
  FormattingUtils,
  FormulaEngine
} from '@/lib/formatting'
import { toast } from 'sonner'

interface SelectedCellInfo {
  cellId: string
  rowIndex: number
  columnIndex: number
  columnId: string
  value: any
  formula?: string
  formatting?: CellFormatting
}

interface FormattingContextType {
  // Selection state
  selectedCell: SelectedCellInfo | null
  selectedCells: string[]
  
  // Formatting state
  cellFormatting: Record<string, CellFormatting>
  
  // Selection methods
  selectCell: (cellInfo: SelectedCellInfo) => void
  selectMultipleCells: (cellIds: string[]) => void
  clearSelection: () => void
  
  // Formatting methods
  applyFormatting: (cellIds: string | string[], formatting: Partial<CellFormatting>) => void
  getFormatting: (cellId: string) => CellFormatting
  getCellDisplayValue: (cellId: string, value: any, formula?: string) => any
  
  // Formula methods
  setFormula: (cellId: string, formula: string) => { value: any, dependencies: string[] }
  getFormula: (cellId: string) => string | undefined
  
  // Data persistence
  loadFormattingData: (rowData: FormattedRowData[]) => void
  getFormattedRowData: () => FormattedRowData[]
  
  // Utility methods
  hasFormatting: (cellId: string) => boolean
  clearFormatting: (cellIds: string | string[]) => void
}

const FormattingContext = createContext<FormattingContextType | undefined>(undefined)

export function FormattingProvider({ children }: { children: React.ReactNode }) {
  const [selectedCell, setSelectedCell] = useState<SelectedCellInfo | null>(null)
  const [selectedCells, setSelectedCells] = useState<string[]>([])
  const [cellFormatting, setCellFormatting] = useState<Record<string, CellFormatting>>({})
  const [cellFormulas, setCellFormulas] = useState<Record<string, string>>({})
  const [cellValues, setCellValues] = useState<Record<string, any>>({})

  const selectCell = useCallback((cellInfo: SelectedCellInfo) => {
    setSelectedCell(cellInfo)
    setSelectedCells([cellInfo.cellId])
  }, [])

  const selectMultipleCells = useCallback((cellIds: string[]) => {
    setSelectedCells(cellIds)
    // Keep the first cell as the primary selected cell
    if (cellIds.length > 0 && selectedCell && cellIds.includes(selectedCell.cellId)) {
      // Keep current selection if it's in the multi-selection
      return
    }
    // Clear single selection when multiple cells are selected
    setSelectedCell(null)
  }, [selectedCell])

  const clearSelection = useCallback(() => {
    setSelectedCell(null)
    setSelectedCells([])
  }, [])

  const applyFormatting = useCallback((cellIds: string | string[], formatting: Partial<CellFormatting>) => {
    const idsArray = Array.isArray(cellIds) ? cellIds : [cellIds]
    
    setCellFormatting(prev => {
      const updated = { ...prev }
      idsArray.forEach(cellId => {
        updated[cellId] = FormattingUtils.mergeFormatting(
          updated[cellId] || DEFAULT_CELL_FORMATTING,
          formatting
        )
      })
      return updated
    })

    toast.success(`Formatting applied to ${idsArray.length} cell${idsArray.length > 1 ? 's' : ''}`, {
      duration: 1000
    })
  }, [])

  const getFormatting = useCallback((cellId: string): CellFormatting => {
    return cellFormatting[cellId] || DEFAULT_CELL_FORMATTING
  }, [cellFormatting])

  const setFormula = useCallback((cellId: string, formula: string): { value: any, dependencies: string[] } => {
    // Parse and calculate the formula
    const { result, dependencies } = FormulaEngine.parseFormula(formula, cellValues)
    
    // Store the formula and calculated value
    setCellFormulas(prev => ({ ...prev, [cellId]: formula }))
    setCellValues(prev => ({ ...prev, [cellId]: result }))
    
    return { value: result, dependencies }
  }, [cellValues])

  const getFormula = useCallback((cellId: string): string | undefined => {
    return cellFormulas[cellId]
  }, [cellFormulas])

  const getCellDisplayValue = useCallback((cellId: string, value: any, formula?: string): any => {
    if (formula && FormulaEngine.isFormula(formula)) {
      const stored = cellValues[cellId]
      if (stored !== undefined) {
        return stored
      }
      // Calculate on the fly if not stored
      const { result } = FormulaEngine.parseFormula(formula, cellValues)
      return result
    }
    return value
  }, [cellValues])

  const loadFormattingData = useCallback((rowData: FormattedRowData[]) => {
    const newFormatting: Record<string, CellFormatting> = {}
    const newFormulas: Record<string, string> = {}
    const newValues: Record<string, any> = {}

    rowData.forEach((row, rowIndex) => {
      Object.entries(row).forEach(([columnId, cellData], columnIndex) => {
        if (columnId === 'id' || columnId === '_rowId') return
        
        const cellId = FormattingUtils.getCellId(rowIndex, columnIndex)
        
        if (typeof cellData === 'object' && cellData !== null && 'formatting' in cellData) {
          // New formatted cell data
          if (cellData.formatting) {
            newFormatting[cellId] = cellData.formatting
          }
          if (cellData.formula) {
            newFormulas[cellId] = cellData.formula
          }
          newValues[cellId] = cellData.value
        } else {
          // Legacy plain value
          newValues[cellId] = cellData
        }
      })
    })

    setCellFormatting(newFormatting)
    setCellFormulas(newFormulas)
    setCellValues(newValues)
  }, [])

  const getFormattedRowData = useCallback((): FormattedRowData[] => {
    // This would need to be implemented to convert back to row format for saving
    // For now, return empty array - this would be called when saving data
    return []
  }, [])

  const hasFormatting = useCallback((cellId: string): boolean => {
    const formatting = cellFormatting[cellId]
    return formatting && !FormattingUtils.isFormattingEqual(formatting, DEFAULT_CELL_FORMATTING)
  }, [cellFormatting])

  const clearFormatting = useCallback((cellIds: string | string[]) => {
    const idsArray = Array.isArray(cellIds) ? cellIds : [cellIds]
    
    setCellFormatting(prev => {
      const updated = { ...prev }
      idsArray.forEach(cellId => {
        delete updated[cellId]
      })
      return updated
    })

    toast.success(`Formatting cleared from ${idsArray.length} cell${idsArray.length > 1 ? 's' : ''}`, {
      duration: 1000
    })
  }, [])

  const value: FormattingContextType = {
    // Selection state
    selectedCell,
    selectedCells,
    
    // Formatting state
    cellFormatting,
    
    // Selection methods
    selectCell,
    selectMultipleCells,
    clearSelection,
    
    // Formatting methods
    applyFormatting,
    getFormatting,
    getCellDisplayValue,
    
    // Formula methods
    setFormula,
    getFormula,
    
    // Data persistence
    loadFormattingData,
    getFormattedRowData,
    
    // Utility methods
    hasFormatting,
    clearFormatting
  }

  return (
    <FormattingContext.Provider value={value}>
      {children}
    </FormattingContext.Provider>
  )
}

export function useFormatting() {
  const context = useContext(FormattingContext)
  if (context === undefined) {
    throw new Error('useFormatting must be used within a FormattingProvider')
  }
  return context
}
