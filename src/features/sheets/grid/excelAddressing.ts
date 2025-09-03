// src/features/sheets/grid/excelAddressing.ts

/**
 * Generates an Excel-style column letter from a zero-based index.
 * 0 -> 'A', 1 -> 'B', 25 -> 'Z', 26 -> 'AA'
 */
export const getColumnLetter = (index: number): string => {
  let letter = '';
  while (index >= 0) {
    letter = String.fromCharCode(65 + (index % 26)) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
};

/**
 * Creates a unique cell ID (e.g., "A1", "B2") from zero-based indices.
 */
export const getCellId = (rowIndex: number, colIndex: number): string => {
  return `${getColumnLetter(colIndex)}${rowIndex + 1}`;
};

/**
 * Parses a column letter (e.g., "A", "AA") into a zero-based index.
 */
export const parseColumnLetter = (letter: string): number => {
  let column = 0;
  const length = letter.length;
  for (let i = 0; i < length; i++) {
    column += (letter.charCodeAt(i) - 64) * Math.pow(26, length - i - 1);
  }
  return column - 1;
};