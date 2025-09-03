import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface BasicInfoCardProps {
  name: string;
  isRequired: boolean;
  isUnique: boolean;
  onFormChange: (field: 'name' | 'is_required' | 'is_unique', value: string | boolean) => void;
}

export function BasicInfoCard({ name, isRequired, isUnique, onFormChange }: BasicInfoCardProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Basic Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="column-name">Column Name *</Label>
          <Input
            id="column-name"
            value={name}
            onChange={(e) => onFormChange('name', e.target.value)}
            placeholder="Enter column name"
            required
          />
        </div>

        <div className="flex items-center space-x-6 pt-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is-required"
              checked={isRequired}
              onCheckedChange={(checked) => onFormChange('is_required', !!checked)}
            />
            <Label htmlFor="is-required">Required</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is-unique"
              checked={isUnique}
              onCheckedChange={(checked) => onFormChange('is_unique', !!checked)}
            />
            <Label htmlFor="is-unique">Unique</Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}