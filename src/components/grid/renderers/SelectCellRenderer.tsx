// src/components/grid/renderers/SelectCellRenderer.tsx
import React from 'react';

// IMPORTANT: Your select options need 'label' and 'color' properties.
interface SelectOption {
  option_value: string;
  option_label: string; 
  color: string;
}

export function SelectCellRenderer(props: { value: any; options: SelectOption[] }) {
  const option = props.options.find(opt => opt.option_value === props.value);
  if (!option) return <span>{props.value}</span>;

  return (
    <span 
      className="px-2 py-0.5 text-xs font-medium rounded-full text-white" 
      style={{ backgroundColor: option.color || '#6B7280' }}
    >
      {option.option_label}
    </span>
  );
}