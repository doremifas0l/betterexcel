// src/components/grid/renderers/CheckboxCellRenderer.tsx
import React from 'react';

export function CheckboxCellRenderer(props: { value: any }) {
  const isChecked = props.value === true || props.value === 'true';
  return (
    <div className="flex items-center justify-center h-full">
      <input type="checkbox" readOnly checked={isChecked} className="pointer-events-none" />
    </div>
  );
}