import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ColumnEditDialog } from '@/components/spreadsheet/dialogs/ColumnEditDialog';
import { ColumnModeIndicator, ColumnModeIconIndicator } from '@/components/ui/ColumnModeIndicator';
import { Badge } from '@/components/ui/badge';
import { Settings, Edit3 } from 'lucide-react';

// This is an example integration component showing how the column editing features work together
export function ColumnManagementExample() {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<any>(null);

  // Mock column data
  const mockColumns = [
    {
      id: 'col-1',
      name: 'Product Name',
      data_type: 'text',
      mode: 'manual' as const,
      sheet_id: 'sheet-1',
    },
    {
      id: 'col-2',
      name: 'Price Category',
      data_type: 'text',
      mode: 'automatic' as const,
      sheet_id: 'sheet-1',
      rulesCount: 3,
    },
    {
      id: 'col-3',
      name: 'Total Price',
      data_type: 'number',
      mode: 'automatic' as const,
      sheet_id: 'sheet-1',
      rulesCount: 1,
    },
    {
      id: 'col-4',
      name: 'Created Date',
      data_type: 'date',
      mode: 'manual' as const,
      sheet_id: 'sheet-1',
    },
  ];

  const handleEditColumn = (column: any) => {
    setSelectedColumn(column);
    setShowEditDialog(true);
  };

  const handleColumnUpdated = () => {
    // In a real application, this would refresh the column data
    console.log('Column updated - refreshing data');
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'text': return 'bg-blue-100 text-blue-800';
      case 'number': return 'bg-green-100 text-green-800';
      case 'date': return 'bg-purple-100 text-purple-800';
      case 'boolean': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Column Management</h2>
        <p className="text-muted-foreground">Example integration of column editing features</p>
      </div>

      {/* Columns List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Sheet Columns</h3>
        
        <div className="grid gap-4">
          {mockColumns.map((column) => (
            <div key={column.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Column Name */}
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{column.name}</h4>
                    <ColumnModeIconIndicator mode={column.mode} />
                  </div>
                  
                  {/* Column Type Badge */}
                  <Badge variant="outline" className={getTypeColor(column.data_type)}>
                    {column.data_type}
                  </Badge>
                  
                  {/* Mode Indicator */}
                  <ColumnModeIndicator 
                    mode={column.mode} 
                    rulesCount={column.rulesCount} 
                    size="md"
                  />
                </div>
                
                {/* Edit Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditColumn(column)}
                  className="gap-2"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </Button>
              </div>
              
              {/* Additional Info */}
              <div className="mt-2 text-sm text-muted-foreground flex items-center gap-4">
                <span>ID: {column.id}</span>
                <span>Mode: {column.mode}</span>
                {column.mode === 'automatic' && column.rulesCount && (
                  <span>Rules: {column.rulesCount}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Demo Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Mode Indicator Examples</h3>
        
        <div className="grid grid-cols-2 gap-6">
          {/* Manual Column Examples */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">Manual Columns</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span>Product Name</span>
                <ColumnModeIndicator mode="manual" />
                <span className="text-xs text-muted-foreground">(No indicator shown)</span>
              </div>
              <div className="flex items-center gap-2">
                <span>Description</span>
                <ColumnModeIconIndicator mode="manual" />
                <span className="text-xs text-muted-foreground">(No icon shown)</span>
              </div>
            </div>
          </div>
          
          {/* Automatic Column Examples */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">Automatic Columns</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span>Status</span>
                <ColumnModeIndicator mode="automatic" rulesCount={2} />
              </div>
              <div className="flex items-center gap-2">
                <span>Category</span>
                <ColumnModeIndicator mode="automatic" rulesCount={5} size="md" />
              </div>
              <div className="flex items-center gap-2">
                <span>In header</span>
                <ColumnModeIconIndicator mode="automatic" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Integration Notes */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <h4 className="font-medium text-sm">Integration Notes</h4>
        <ul className="text-sm space-y-1 text-muted-foreground">
          <li>• The ColumnEditDialog integrates with the real database via useDatabase hook</li>
          <li>• ColumnReferencePicker provides hierarchical column selection</li>
          <li>• DataConversionPreview shows impact of type changes</li>
          <li>• ColumnModeIndicator components show visual cues for automatic columns</li>
          <li>• All components support real automation rules with strict mode</li>
        </ul>
      </div>

      {/* Column Edit Dialog */}
      <ColumnEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        column={selectedColumn}
        onColumnUpdated={handleColumnUpdated}
      />
    </div>
  );
}
