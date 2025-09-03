import React, { useState, useEffect } from 'react';
import { ICellRendererParams } from 'ag-grid-community';
import { ExternalLink, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- CHANGE #1: Import the new, focused hook for linked records ---
import { useLinkedRecords } from '@/hooks/features/useLinkedRecords';

interface LinkCellRendererProps extends ICellRendererParams {
  linkConfig: {
    target_table_id: string;
    display_column_id?: string;
  };
}

export function LinkCellRenderer({ value, linkConfig }: LinkCellRendererProps) {
  // --- CHANGE #2: Initialize the new hook ---
  const { resolveLinkValue } = useLinkedRecords();
  
  const [displayValue, setDisplayValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBroken, setIsBroken] = useState(false);

  useEffect(() => {
    const loadDisplayValue = async () => {
      if (!value) {
        setDisplayValue('');
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const resolved = await resolveLinkValue(value, linkConfig.display_column_id);
        
        if (resolved === null) {
          setDisplayValue('#REF');
          setIsBroken(true);
        } else {
          setDisplayValue(resolved);
          setIsBroken(false);
        }
      } catch (error) {
        console.error('Error resolving link value:', error);
        setDisplayValue('#REF');
        setIsBroken(true);
      } finally {
        setLoading(false);
      }
    };

    loadDisplayValue();
  }, [value, linkConfig, resolveLinkValue]);

  if (loading) {
    return (
      <div className="flex items-center space-x-1 h-full">
        <div className="animate-pulse text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!value) {
    return (
      <div className="text-gray-400 text-sm h-full flex items-center">
        <span>No link</span>
      </div>
    );
  }

  if (isBroken) {
    return (
      <div 
        className="flex items-center space-x-1 h-full text-red-600 cursor-help"
        title="Broken reference - the linked record may have been deleted"
      >
        <AlertTriangle className="h-3 w-3" />
        <span className="text-sm font-mono">#REF</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-1 h-full group">
      <span 
        className={cn(
          "text-sm text-blue-600 underline cursor-pointer hover:text-blue-800 truncate",
          "decoration-dotted hover:decoration-solid"
        )}
        title={`Linked to: ${displayValue} (Click to edit link)`}
      >
        {displayValue}
      </span>
      <ExternalLink className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

LinkCellRenderer.displayName = 'LinkCellRenderer';