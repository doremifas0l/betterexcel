// Formatting types and utilities for Excel-like functionality

export interface CellFormatting {
  // Font properties
  fontFamily?: string
  fontSize?: number
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
  textDecoration?: 'none' | 'underline'
  
  // Text alignment
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  
  // Colors
  backgroundColor?: string
  textColor?: string
  
  // Text wrapping and indentation
  textWrap?: boolean
  textIndent?: number
  
  // Borders (future enhancement)
  borderTop?: string
  borderRight?: string
  borderBottom?: string
  borderLeft?: string
  
  // Cell formatting
  numberFormat?: string // 'general' | 'number' | 'currency' | 'percentage' | 'date'
  
  // List formatting
  listStyle?: 'none' | 'bullet' | 'numbered'
}

export interface FormulaData {
  cellId: string
  formula: string
  calculatedValue: string | number
  dependencies: string[]
}

export interface CellData {
  value: any
  formatting?: CellFormatting
  formula?: string
}

// Extended row data structure
export interface FormattedRowData {
  [columnId: string]: CellData | any // Support both new formatted cells and legacy plain values
}

// Font families available in the application
export const FONT_FAMILIES = [
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Calibri', value: 'Calibri, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Helvetica', value: 'Helvetica, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
  { label: 'Comic Sans MS', value: '"Comic Sans MS", cursive' },
  { label: 'Impact', value: 'Impact, sans-serif' },
  { label: 'Courier New', value: '"Courier New", monospace' }
]

// Font sizes in points
export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 48, 72]

// Excel-like color palette
export const EXCEL_COLORS = {
  // Standard colors
  standard: [
    '#C00000', '#FF0000', '#FFC000', '#FFFF00', '#92D050', '#00B050',
    '#00B0F0', '#0070C0', '#002060', '#7030A0'
  ],
  // Theme colors - Light versions
  themeLight: [
    '#FFFFFF', '#F2F2F2', '#D9D9D9', '#BFBFBF', '#A5A5A5', '#7F7F7F',
    '#595959', '#3F3F3F', '#262626', '#0C0C0C'
  ],
  // Theme colors - Accent versions
  themeAccent: [
    '#E7E6E6', '#D1C3C4', '#C5504B', '#F79646', '#9BBB59', '#4F81BD',
    '#4BACC6', '#9F4C96', '#8064A2', '#1F497D'
  ],
  // More colors for comprehensive selection
  extended: [
    '#FFCCCC', '#FFCC99', '#FFFF99', '#CCFFCC', '#CCFFFF', '#CCCCFF',
    '#FFCCFF', '#FF9999', '#FF9966', '#FFFF66', '#99FF99', '#99FFFF',
    '#9999FF', '#FF99FF', '#FF6666', '#FF6600', '#FFFF00', '#66FF66',
    '#66FFFF', '#6666FF', '#FF66FF', '#FF3333', '#FF3300', '#FFFF33',
    '#33FF33', '#33FFFF', '#3333FF', '#FF33FF'
  ]
}

// Default cell formatting
export const DEFAULT_CELL_FORMATTING: CellFormatting = {
  fontFamily: 'Calibri, sans-serif',
  fontSize: 11,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  textAlign: 'left',
  verticalAlign: 'middle',
  backgroundColor: '#FFFFFF',
  textColor: '#000000',
  textWrap: false,
  textIndent: 0,
  numberFormat: 'general'
}

// Utility functions for formatting
export class FormattingUtils {
  static getCellId(rowIndex: number, columnIndex: number): string {
    const columnLetter = this.getColumnLetter(columnIndex)
    return `${columnLetter}${rowIndex + 1}`
  }

  static getColumnLetter(index: number): string {
    let letter = ''
    while (index >= 0) {
      letter = String.fromCharCode(65 + (index % 26)) + letter
      index = Math.floor(index / 26) - 1
    }
    return letter
  }

  static parseColumnLetter(letter: string): number {
    let result = 0
    for (let i = 0; i < letter.length; i++) {
      result = result * 26 + (letter.charCodeAt(i) - 64)
    }
    return result - 1
  }

  static applyCellFormatting(formatting: CellFormatting): React.CSSProperties {
    return {
      fontFamily: formatting.fontFamily || DEFAULT_CELL_FORMATTING.fontFamily,
      fontSize: `${formatting.fontSize || DEFAULT_CELL_FORMATTING.fontSize}pt`,
      fontWeight: formatting.fontWeight || DEFAULT_CELL_FORMATTING.fontWeight,
      fontStyle: formatting.fontStyle || DEFAULT_CELL_FORMATTING.fontStyle,
      textDecoration: formatting.textDecoration || DEFAULT_CELL_FORMATTING.textDecoration,
      textAlign: formatting.textAlign || DEFAULT_CELL_FORMATTING.textAlign,
      verticalAlign: formatting.verticalAlign || DEFAULT_CELL_FORMATTING.verticalAlign,
      backgroundColor: formatting.backgroundColor || DEFAULT_CELL_FORMATTING.backgroundColor,
      color: formatting.textColor || DEFAULT_CELL_FORMATTING.textColor,
      whiteSpace: formatting.textWrap ? 'pre-wrap' : 'nowrap',
      textIndent: formatting.textIndent ? `${formatting.textIndent}px` : '0px',
      borderTop: formatting.borderTop,
      borderRight: formatting.borderRight,
      borderBottom: formatting.borderBottom,
      borderLeft: formatting.borderLeft
    }
  }

  static mergeFormatting(base: CellFormatting, override: Partial<CellFormatting>): CellFormatting {
    return { ...base, ...override }
  }

  static isFormattingEqual(a: CellFormatting, b: CellFormatting): boolean {
    return JSON.stringify(a) === JSON.stringify(b)
  }
}

// Basic formula calculation engine
export class FormulaEngine {
  private static BASIC_FUNCTIONS = ['SUM', 'AVERAGE', 'COUNT', 'MIN', 'MAX']

  static isFormula(text: string): boolean {
    return typeof text === 'string' && text.trim().startsWith('=')
  }

  static parseFormula(formula: string, cellData: Record<string, any>): { result: any, dependencies: string[] } {
    if (!this.isFormula(formula)) {
      return { result: formula, dependencies: [] }
    }

    const cleanFormula = formula.substring(1).trim() // Remove '=' prefix
    const dependencies: string[] = []

    try {
      // Extract cell references (A1, B2, etc.)
      const cellRefs = cleanFormula.match(/[A-Z]+\d+/g) || []
      dependencies.push(...cellRefs)

      let processedFormula = cleanFormula

      // Replace cell references with actual values
      cellRefs.forEach(cellRef => {
        const cellValue = cellData[cellRef] || 0
        const numericValue = this.convertToNumber(cellValue)
        processedFormula = processedFormula.replace(new RegExp(cellRef, 'g'), numericValue.toString())
      })

      // Handle basic functions
      processedFormula = this.processFunctions(processedFormula, cellData)

      // Evaluate mathematical expression
      const result = this.evaluateExpression(processedFormula)
      return { result, dependencies }
    } catch (error) {
      console.error('Formula calculation error:', error)
      return { result: '#ERROR!', dependencies }
    }
  }

  private static processFunctions(formula: string, cellData: Record<string, any>): string {
    let processedFormula = formula

    // Handle SUM function: SUM(A1:A10)
    processedFormula = processedFormula.replace(/SUM\(([A-Z]+\d+):([A-Z]+\d+)\)/g, (match, start, end) => {
      const sum = this.calculateRangeFunction(start, end, cellData, 'SUM')
      return sum.toString()
    })

    // Handle AVERAGE function
    processedFormula = processedFormula.replace(/AVERAGE\(([A-Z]+\d+):([A-Z]+\d+)\)/g, (match, start, end) => {
      const avg = this.calculateRangeFunction(start, end, cellData, 'AVERAGE')
      return avg.toString()
    })

    // Handle COUNT function
    processedFormula = processedFormula.replace(/COUNT\(([A-Z]+\d+):([A-Z]+\d+)\)/g, (match, start, end) => {
      const count = this.calculateRangeFunction(start, end, cellData, 'COUNT')
      return count.toString()
    })

    // Handle MIN function
    processedFormula = processedFormula.replace(/MIN\(([A-Z]+\d+):([A-Z]+\d+)\)/g, (match, start, end) => {
      const min = this.calculateRangeFunction(start, end, cellData, 'MIN')
      return min.toString()
    })

    // Handle MAX function
    processedFormula = processedFormula.replace(/MAX\(([A-Z]+\d+):([A-Z]+\d+)\)/g, (match, start, end) => {
      const max = this.calculateRangeFunction(start, end, cellData, 'MAX')
      return max.toString()
    })

    return processedFormula
  }

  private static calculateRangeFunction(start: string, end: string, cellData: Record<string, any>, func: string): number {
    const startCol = FormattingUtils.parseColumnLetter(start.match(/[A-Z]+/)?.[0] || 'A')
    const startRow = parseInt(start.match(/\d+/)?.[0] || '1') - 1
    const endCol = FormattingUtils.parseColumnLetter(end.match(/[A-Z]+/)?.[0] || 'A')
    const endRow = parseInt(end.match(/\d+/)?.[0] || '1') - 1

    const values: number[] = []

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const cellId = FormattingUtils.getCellId(row, col)
        const cellValue = cellData[cellId]
        if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
          const numValue = this.convertToNumber(cellValue)
          if (!isNaN(numValue)) {
            values.push(numValue)
          }
        }
      }
    }

    switch (func) {
      case 'SUM':
        return values.reduce((sum, val) => sum + val, 0)
      case 'AVERAGE':
        return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0
      case 'COUNT':
        return values.length
      case 'MIN':
        return values.length > 0 ? Math.min(...values) : 0
      case 'MAX':
        return values.length > 0 ? Math.max(...values) : 0
      default:
        return 0
    }
  }

  private static convertToNumber(value: any): number {
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
      const num = parseFloat(value)
      return isNaN(num) ? 0 : num
    }
    return 0
  }

  private static evaluateExpression(expression: string): number {
    try {
      // Safety check - only allow basic mathematical operations
      if (!/^[0-9+\-*/.() ]+$/.test(expression)) {
        throw new Error('Invalid characters in expression')
      }
      
      // Use Function constructor for safe evaluation of mathematical expressions
      return Function('"use strict"; return (' + expression + ')')() || 0
    } catch (error) {
      throw new Error('Invalid mathematical expression')
    }
  }
}
