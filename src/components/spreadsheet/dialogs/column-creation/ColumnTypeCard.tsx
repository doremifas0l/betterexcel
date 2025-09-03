import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const COLUMN_TYPES = [
    { value: 'text', label: 'Text', description: 'Single line text' },
    { value: 'textarea', label: 'Long Text', description: 'Multi-line text' },
    { value: 'number', label: 'Number', description: 'Integer or decimal numbers' },
    { value: 'date', label: 'Date', description: 'Date picker' },
    { value: 'checkbox', label: 'Checkbox', description: 'True/false toggle' },
    { value: 'select', label: 'Select', description: 'Dropdown with options' },
    { value: 'link', label: 'Link', description: 'Reference to another table' },
    { value: 'rollup', label: 'Rollup', description: 'Aggregate linked records' },
    // Add other types as needed
];

interface ColumnTypeCardProps {
  dataType: string;
  onDataTypeChange: (newType: string) => void;
}

export function ColumnTypeCard({ dataType, onDataTypeChange }: ColumnTypeCardProps) {
  const selectedType = COLUMN_TYPES.find(type => type.value === dataType);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Column Type</CardTitle>
        <CardDescription>
          Determines how values are stored and validated.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="column-type">Data Type *</Label>
          <Select value={dataType} onValueChange={onDataTypeChange}>
            <SelectTrigger id="column-type">
              <SelectValue placeholder="Select a type" />
            </SelectTrigger>
            <SelectContent>
              {COLUMN_TYPES.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedType && (
            <p className="text-xs text-muted-foreground">{selectedType.description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}