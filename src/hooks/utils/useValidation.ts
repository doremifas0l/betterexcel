import { useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Column } from '@/lib/supabase'; // Ensure Column type is defined and exported

/**
 * Provides utility functions for data validation and dependency checks.
 */
export function useValidation() {
  const { user } = useAuth();

  /**
   * Validates a value against a column's rules (required, data type, custom rules).
   */
  const validateColumnData = useCallback((value: any, column: Column): { valid: boolean; error?: string } => {
    if (column.is_required && (!value || value.toString().trim() === '')) {
      return { valid: false, error: `${column.name} is required` };
    }
    
    if (value && value.toString().trim() !== '') {
      switch (column.data_type) {
        case 'number':
          if (isNaN(Number(value))) {
            return { valid: false, error: `${column.name} must be a valid number` };
          }
          break;
        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            return { valid: false, error: `${column.name} must be a valid email address` };
          }
          break;
        case 'date':
        case 'datetime':
          if (isNaN(Date.parse(value))) {
            return { valid: false, error: `${column.name} must be a valid date` };
          }
          break;
      }
    }
    
    if (column.validation_rules) {
      const rules = column.validation_rules;
      if (rules.min && Number(value) < rules.min) {
        return { valid: false, error: `${column.name} must be at least ${rules.min}` };
      }
      if (rules.max && Number(value) > rules.max) {
        return { valid: false, error: `${column.name} must be at most ${rules.max}` };
      }
      if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
        return { valid: false, error: `${column.name} format is invalid` };
      }
    }
    
    return { valid: true };
  }, []);

  /**
   * Checks all tables to see if any records link to the specified rowId.
   */
  const checkRowDependencies = useCallback(async (rowId: string): Promise<{
    hasLinks: boolean;
    dependencies: { tableName: string; sheetName: string; columnName: string; count: number }[];
  }> => {
    if (!user) return { hasLinks: false, dependencies: [] };
    
    try {
      const { data: linkConfigs, error: configError } = await supabase.from('link_configurations').select(`*`);
      if (configError) throw configError;

      const dependencies = [];
      for (const config of linkConfigs || []) {
        const { data: columnInfo } = await supabase.from('columns').select(`name, sheet_id`).eq('id', config.column_id).single();
        if (!columnInfo) continue;

        const { data: sheetInfo } = await supabase.from('better_sheets').select(`name, better_tables!inner(name)`).eq('id', columnInfo.sheet_id).single();
        if (!sheetInfo) continue;

        const { count, error: countError } = await supabase
          .from('rows')
          .select('id', { count: 'exact', head: true })
          .eq('sheet_id', columnInfo.sheet_id)
          .like('row_data', `%"${config.column_id}":"${rowId}"%`);
        
        if (!countError && count && count > 0) {
          dependencies.push({
            tableName: (sheetInfo.better_tables as any)?.name || 'Unknown Table',
            sheetName: sheetInfo.name,
            columnName: columnInfo.name,
            count
          });
        }
      }
      return { hasLinks: dependencies.length > 0, dependencies };
    } catch (error) {
      console.error('Error checking row dependencies:', error);
      return { hasLinks: false, dependencies: [] };
    }
  }, [user]);

  /**
   * Checks for dependencies before deleting a row and returns warnings if found.
   */
  const validateRowBeforeDeletion = useCallback(async (rowId: string): Promise<{
    canDelete: boolean;
    warnings: string[];
    dependencies: { tableName: string; sheetName: string; columnName: string; count: number }[];
  }> => {
    if (!user) return { canDelete: true, warnings: [], dependencies: [] };
    try {
      const dependencyCheck = await checkRowDependencies(rowId);
      if (dependencyCheck.hasLinks) {
        return {
          canDelete: false,
          warnings: [`This record is linked from ${dependencyCheck.dependencies.length} other location(s).`, 'Deleting it will create broken references.'],
          dependencies: dependencyCheck.dependencies
        };
      }
      return { canDelete: true, warnings: [], dependencies: [] };
    } catch (error) {
      return { canDelete: true, warnings: ['Unable to check dependencies'], dependencies: [] };
    }
  }, [user, checkRowDependencies]); // This hook calls another function within the same hook.

  return {
    validateColumnData,
    checkRowDependencies,
    validateRowBeforeDeletion,
  };
}