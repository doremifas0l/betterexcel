import React, { forwardRef } from 'react';
import { AgGridReact, AgGridReactProps } from 'ag-grid-react';

// Import AG Grid's core and our custom theme styles.
import 'ag-grid-community/styles/ag-grid.css';
import '@/styles/enhanced-excel.css';

/**
 * A thin, reusable wrapper for the AgGridReact grid, correctly using forwardRef.
 */
export const GridView = forwardRef<AgGridReact, AgGridReactProps>((props, ref) => {
  return (
    <div className="ag-theme-excel h-full w-full">
      <AgGridReact
        // Forward the ref from the parent to the AgGridReact component.
        ref={ref}
        // Spread all other props from the parent.
        {...props}
        // Define any consistent, default props here.
        rowSelection="multiple"
        suppressRowClickSelection={true}
      />
    </div>
  );
});

// Add a displayName for better debugging.
GridView.displayName = 'GridView';