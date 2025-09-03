// src/features/sheets/services/ValidationService.ts

// We will centralize this type later in a file like 'domain.ts'.
// For now, defining it here is perfect.
export type Column = {
  id: string;
  name: string;
  data_type: string;
  is_required?: boolean;
  validation_rules?: any;
};

export type ValidationResult = {
  valid: boolean;
  error?: string;
};

/**
 * Validates a given value against a column's rules.
 * @param value The new value to check.
 * @param column The column definition containing the rules.
 * @returns A ValidationResult object.
 */
export function validateColumnData(value: any, column: Column): ValidationResult {
  // Check for required rule
  if (column.is_required && (value === null || value === undefined || value === '')) {
    return { valid: false, error: `Column "${column.name}" is required.` };
  }

  // Check for number type rule
  if (column.data_type === 'number' && value !== '' && value !== null && value !== undefined) {
    if (isNaN(Number(value))) {
      return { valid: false, error: `Value for "${column.name}" must be a number.` };
    }
  }

  // Add more validation rules here as needed (e.g., for email, URL, etc.)

  return { valid: true };
}