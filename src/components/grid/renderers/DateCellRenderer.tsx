// src/components/grid/renderers/DateCellRenderer.tsx
import React from 'react';
import { format } from 'date-fns';

export function DateCellRenderer(props: { value: any }) {
  if (!props.value) return null;
  try {
    return <span>{format(new Date(props.value), 'MMM d, yyyy')}</span>;
  } catch {
    return <span>{props.value}</span>;
  }
}