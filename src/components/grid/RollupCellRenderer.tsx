import React, { useState, useEffect } from 'react';
import { ICellRendererParams } from 'ag-grid-community';
import { Calculator, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- CHANGE #1: Import the new, focused hook ---
import { useRollups } from '@/hooks/features/useRollups';

interface RollupCellRendererProps extends ICellRendererParams {
  rollupConfig: {
    id: string;
    source_link_column_id: string;
    source_field_column_id: string;
    aggregation_function: 'count' | 'sum' | 'avg' | 'min' | 'max';
  };
}

export function RollupCellRenderer({ value, data, rollupConfig }: RollupCellRendererProps) {
  // --- CHANGE #2: Initialize the new hook ---
  const { calculateRollupValue } = useRollups();

  const [rollupValue, setRollupValue] = useState<string | null>(value || null);
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (data?._rowId && rollupConfig?.id) {
      calculateAndSetRollupValue();
    }
  }, [data?._rowId, rollupConfig, calculateRollupValue]); // Added calculateRollupValue to dependency array

  const calculateAndSetRollupValue = async () => {
    if (!data?._rowId || !rollupConfig?.id) {
      setRollupValue('0');
      return;
    }

    setLoading(true);
    setHasError(false);
    
    try {
      const calculatedValue = await calculateRollupValue(rollupConfig.id, data._rowId);
      
      if (calculatedValue === null || calculatedValue.startsWith('ERROR')) {
        setHasError(true);
        setRollupValue('ERROR');
      } else {
        setRollupValue(calculatedValue || '0');
      }
    } catch (error) {
      console.error('Error calculating rollup value:', error);
      setHasError(true);
      setRollupValue('ERROR');
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (val: string) => {
    if (!val || val === 'ERROR') return val;
    
    switch (rollupConfig.aggregation_function) {
      case 'sum':
      case 'avg':
      case 'min':
      case 'max':
        const numValue = parseFloat(val);
        if (isNaN(numValue)) return val;
        
        if (numValue >= 1_000_000) return (numValue / 1_000_000).toFixed(1) + 'M';
        if (numValue >= 1_000) return (numValue / 1_000).toFixed(1) + 'k';
        return numValue.toLocaleString(undefined, { maximumFractionDigits: 2 });
      default: // 'count' and any other case
        return val;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-1 h-full text-muted-foreground">
        <Calculator className="h-3 w-3 animate-pulse" />
        <span className="text-sm animate-pulse">Calculating...</span>
      </div>
    );
  }

  if (hasError) {
    return (
      <div 
        className="flex items-center space-x-1 h-full text-destructive cursor-help"
        title="Error calculating rollup - check configuration"
      >
        <AlertTriangle className="h-3 w-3" />
        <span className="text-sm font-mono">ERROR</span>
      </div>
    );
  }

  return (
    <div 
      className="flex items-center space-x-1 h-full group cursor-pointer" 
      onClick={calculateAndSetRollupValue}
      title={`Rollup: ${rollupConfig.aggregation_function.toUpperCase()} | Click to refresh`}
    >
      <Calculator className="h-3 w-3 text-primary opacity-70 group-hover:opacity-100 transition-opacity" />
      <span 
        className={cn(
          "text-sm font-medium",
          "bg-blue-50 px-1.5 py-0.5 rounded text-blue-800",
          "border border-blue-200"
        )}
      >
        {formatValue(rollupValue || '0')}
      </span>
    </div>
  );
}

RollupCellRenderer.displayName = 'RollupCellRenderer';