import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConversionResult {
  originalValue: any;
  convertedValue: any;
  success: boolean;
  error?: string;
  rowIndex: number;
}

interface DataConversionPreviewProps {
  columnId: string;
  fromType: string;
  toType: string;
  sampleData?: any[];
  className?: string;
}

export function DataConversionPreview({
  columnId,
  fromType,
  toType,
  sampleData = [],
  className,
}: DataConversionPreviewProps) {
  const [conversionResults, setConversionResults] = useState<ConversionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{
    total: number;
    successful: number;
    failed: number;
    warningCount: number;
  }>({ total: 0, successful: 0, failed: 0, warningCount: 0 });

  // Mock sample data if not provided
  const mockSampleData = sampleData.length > 0 ? sampleData : [
    'Sample Text 1',
    '123.45',
    'true',
    '2024-01-15',
    '',
    'false',
    'Invalid Data',
    '999',
  ];

  const convertValue = (value: any, targetType: string): ConversionResult['convertedValue'] => {
    if (value === null || value === undefined || value === '') {
      return { success: true, value: null, warning: 'Empty value' };
    }

    try {
      switch (targetType) {
        case 'text':
          return { success: true, value: String(value) };
        
        case 'number':
          const numValue = Number(value);
          if (isNaN(numValue)) {
            return { success: false, value: null, error: 'Cannot convert to number' };
          }
          return { success: true, value: numValue };
        
        case 'boolean':
          if (typeof value === 'boolean') {
            return { success: true, value };
          }
          const strValue = String(value).toLowerCase();
          if (['true', '1', 'yes', 'y'].includes(strValue)) {
            return { success: true, value: true };
          }
          if (['false', '0', 'no', 'n'].includes(strValue)) {
            return { success: true, value: false };
          }
          return { success: false, value: null, error: 'Cannot convert to boolean' };
        
        case 'date':
          const dateValue = new Date(value);
          if (isNaN(dateValue.getTime())) {
            return { success: false, value: null, error: 'Invalid date format' };
          }
          return { success: true, value: dateValue.toISOString().split('T')[0] };
        
        default:
          return { success: false, value: null, error: 'Unknown target type' };
      }
    } catch (error) {
      return { success: false, value: null, error: 'Conversion failed' };
    }
  };

  const previewConversion = async () => {
    setLoading(true);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const results: ConversionResult[] = mockSampleData.map((value, index) => {
      const conversion = convertValue(value, toType);
      return {
        originalValue: value,
        convertedValue: conversion.value,
        success: conversion.success,
        error: conversion.error,
        rowIndex: index + 1,
      };
    });
    
    setConversionResults(results);
    
    // Calculate summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const warningCount = results.filter(r => r.success && r.convertedValue === null).length;
    
    setSummary({
      total: results.length,
      successful,
      failed,
      warningCount,
    });
    
    setLoading(false);
  };

  useEffect(() => {
    if (fromType !== toType) {
      previewConversion();
    } else {
      setConversionResults([]);
      setSummary({ total: 0, successful: 0, failed: 0, warningCount: 0 });
    }
  }, [fromType, toType, columnId]);

  if (fromType === toType) {
    return null;
  }

  const getStatusIcon = (success: boolean, hasWarning: boolean) => {
    if (!success) return <XCircle className="h-4 w-4 text-destructive" />;
    if (hasWarning) return <AlertTriangle className="h-4 w-4 text-warning" />;
    return <CheckCircle className="h-4 w-4 text-green-600" />;
  };

  const getSeverityLevel = () => {
    if (summary.failed > 0) return 'error';
    if (summary.warningCount > 0) return 'warning';
    return 'success';
  };

  const severityLevel = getSeverityLevel();

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="font-medium">Data Conversion Preview</h4>
          <Badge variant="outline">
            {fromType} → {toType}
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={previewConversion}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Summary Alert */}
      {conversionResults.length > 0 && (
        <Alert className={cn(
          severityLevel === 'error' && 'border-destructive bg-destructive/5',
          severityLevel === 'warning' && 'border-warning bg-warning/5',
          severityLevel === 'success' && 'border-green-500 bg-green-50'
        )}>
          <div className="flex items-start gap-2">
            {getStatusIcon(summary.failed === 0, summary.warningCount > 0)}
            <AlertDescription>
              <div className="font-medium mb-1">
                Conversion Summary ({summary.total} rows)
              </div>
              <div className="text-sm space-y-1">
                <div className="flex gap-4">
                  <span className="text-green-600">✓ {summary.successful} successful</span>
                  {summary.failed > 0 && (
                    <span className="text-destructive">✗ {summary.failed} failed</span>
                  )}
                  {summary.warningCount > 0 && (
                    <span className="text-warning">⚠ {summary.warningCount} warnings</span>
                  )}
                </div>
                {summary.failed > 0 && (
                  <div className="text-destructive text-xs">
                    Failed conversions will result in null values
                  </div>
                )}
              </div>
            </AlertDescription>
          </div>
        </Alert>
      )}

      {/* Conversion Results Table */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Analyzing data conversion...</span>
        </div>
      ) : conversionResults.length > 0 ? (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Row</TableHead>
                <TableHead>Original ({fromType})</TableHead>
                <TableHead>Converted ({toType})</TableHead>
                <TableHead className="w-16">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conversionResults.slice(0, 8).map((result, index) => (
                <TableRow key={index}>
                  <TableCell className="font-mono text-sm">
                    {result.rowIndex}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {result.originalValue === '' ? (
                      <span className="text-muted-foreground italic">empty</span>
                    ) : (
                      String(result.originalValue)
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {result.success ? (
                      result.convertedValue === null ? (
                        <span className="text-muted-foreground italic">null</span>
                      ) : (
                        String(result.convertedValue)
                      )
                    ) : (
                      <span className="text-destructive italic">failed</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getStatusIcon(result.success, result.convertedValue === null)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {conversionResults.length > 8 && (
            <div className="p-3 bg-muted/50 text-center text-sm text-muted-foreground">
              Showing first 8 of {conversionResults.length} rows
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
