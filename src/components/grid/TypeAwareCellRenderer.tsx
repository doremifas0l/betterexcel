// src/components/grid/TypeAwareCellRenderer.tsx
import React from 'react';
import type { ICellRendererParams } from 'ag-grid-community';

// Import our new specialized renderers
import { SelectCellRenderer } from './renderers/SelectCellRenderer';
import { DateCellRenderer } from './renderers/DateCellRenderer';
import { CheckboxCellRenderer } from './renderers/CheckboxCellRenderer';

// Import your existing powerful renderer
import { FormattedCellRenderer } from './FormattedCellRenderer'; 

// This component will receive all the AG Grid params
export function TypeAwareCellRenderer(params: ICellRendererParams) {
  // We will pass the column's data type via cellRendererParams
  const dataType = params.colDef?.cellRendererParams?.dataType;
  
  // Now, we dispatch to the correct component
  switch (dataType) {
    case 'select':
      // Pass the specific props needed by the SelectCellRenderer
      return (
        <SelectCellRenderer 
          value={params.value} 
          options={params.colDef?.cellRendererParams?.options || []} 
        />
      );
    case 'date':
    case 'datetime':
      return <DateCellRenderer value={params.value} />;
    case 'checkbox':
      return <CheckboxCellRenderer value={params.value} />;
    
    // For all other types, we fall back to your powerful existing renderer
    default:
      return <FormattedCellRenderer {...params} />;
  }
}