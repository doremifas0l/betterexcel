import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { ColumnReferencePicker } from './ColumnReferencePicker';
import { DataConversionPreview } from '@/components/ui/DataConversionPreview';
import { useDatabase } from '@/hooks/useDatabase';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

interface ColumnEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  column?: {
    id: string;
    name: string;
    data_type: string;
    mode: 'manual' | 'automatic';
    sheet_id: string;
  };
  onColumnUpdated?: () => void;
}

interface AutomationRule {
  rule_type: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'greater_equal' | 'less_equal';
  condition_value: string;
  result_value: string;
  rule_order: number;
  strict_mode: boolean;
}

export function ColumnEditDialog({
  open,
  onOpenChange,
  column,
  onColumnUpdated,
}: ColumnEditDialogProps) {
  const {
    updateColumn,
    getAutomatedColumnConfig,
    updateAutomatedColumnConfig,
    getColumnSampleData,
  } = useDatabase();

  const [name, setName] = useState('');
  const [type, setType] = useState('text');
  const [mode, setMode] = useState<'manual' | 'automatic'>('manual');
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [selectedReferenceColumn, setSelectedReferenceColumn] = useState<any>(null);
  const [defaultValue, setDefaultValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showReferencePicker, setShowReferencePicker] = useState(false);
  const [sampleData, setSampleData] = useState<any[]>([]);

  // Initialize form with column data when dialog opens
  useEffect(() => {
    if (column && open) {
      setName(column.name);
      setType(column.data_type);
      setMode(column.mode);
      setDefaultValue('');
      setAutomationRules([]);
      setSelectedReferenceColumn(null);
      
      // Load automation config if it's an automatic column
      if (column.mode === 'automatic') {
        loadAutomationConfig();
      }
      
      // Load sample data for conversion preview
      loadSampleData();
    }
  }, [column, open]);

  const loadAutomationConfig = async () => {
    if (!column) return;
    
    try {
      const config = await getAutomatedColumnConfig(column.id);
      if (config) {
        setDefaultValue(config.default_value || '');
        setAutomationRules(config.rules || []);
        // TODO: Set selected reference column based on config
      }
    } catch (error) {
      console.error('Error loading automation config:', error);
    }
  };

  const loadSampleData = async () => {
    if (!column) return;
    
    try {
      const data = await getColumnSampleData(column.id, 8);
      setSampleData(data);
    } catch (error) {
      console.error('Error loading sample data:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!column) return;

    setIsLoading(true);
    try {
      // Update the column
      const success = await updateColumn(column.id, {
        name,
        data_type: type,
        mode,
      });
      
      if (!success) {
        return;
      }
      
      // Update automation config if mode is automatic
      if (mode === 'automatic') {
        const configSuccess = await updateAutomatedColumnConfig(column.id, {
          source_column_id: selectedReferenceColumn?.id,
          default_value: defaultValue,
          rules: automationRules,
        });
        
        if (!configSuccess) {
          return;
        }
      }
      
      onColumnUpdated?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating column:', error);
      toast.error('Failed to update column');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original values
    if (column) {
      setName(column.name);
      setType(column.data_type);
      setMode(column.mode);
      setDefaultValue('');
      setAutomationRules([]);
      setSelectedReferenceColumn(null);
    }
    onOpenChange(false);
  };

  const addRule = () => {
    const newRule: AutomationRule = {
      rule_type: 'equals',
      condition_value: '',
      result_value: '',
      rule_order: automationRules.length,
      strict_mode: false,
    };
    setAutomationRules([...automationRules, newRule]);
  };

  const updateRule = (index: number, updates: Partial<AutomationRule>) => {
    const updatedRules = automationRules.map((rule, i) => 
      i === index ? { ...rule, ...updates } : rule
    );
    setAutomationRules(updatedRules);
  };

  const removeRule = (index: number) => {
    const updatedRules = automationRules.filter((_, i) => i !== index)
      .map((rule, i) => ({ ...rule, rule_order: i }));
    setAutomationRules(updatedRules);
  };

  const handleReferenceColumnSelect = (selectedColumn: any) => {
    setSelectedReferenceColumn(selectedColumn);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit Column: {column?.name || 'Unknown'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                {/* Column Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Column Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter column name"
                    required
                  />
                </div>

                {/* Column Type */}
                <div className="space-y-2">
                  <Label>Column Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select column type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="boolean">Boolean</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Column Mode */}
                <div className="space-y-3">
                  <Label>Mode</Label>
                  <RadioGroup
                    value={mode}
                    onValueChange={(value: 'manual' | 'automatic') => setMode(value)}
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="manual" id="manual" />
                      <Label htmlFor="manual" className="cursor-pointer">
                        Manual
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="automatic" id="automatic" />
                      <Label htmlFor="automatic" className="cursor-pointer">
                        Automatic
                      </Label>
                    </div>
                  </RadioGroup>
                  <p className="text-sm text-muted-foreground">
                    {mode === 'manual'
                      ? 'Values are entered manually by users'
                      : 'Values are automatically calculated based on rules'}
                  </p>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Data Conversion Preview */}
                {type !== column?.data_type && column && (
                  <DataConversionPreview
                    columnId={column.id}
                    fromType={column.data_type}
                    toType={type}
                    sampleData={sampleData}
                  />
                )}
              </div>
            </div>

            {/* Automation Rules */}
            {mode === 'automatic' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Automation Rules</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addRule}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Rule
                  </Button>
                </div>

                {/* Reference Column Selection */}
                <div className="space-y-2">
                  <Label>Reference Column</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowReferencePicker(true)}
                      className="flex-1 justify-start"
                    >
                      {selectedReferenceColumn 
                        ? `${selectedReferenceColumn.table_name || 'Table'} > ${selectedReferenceColumn.name}`
                        : 'Select reference column'
                      }
                    </Button>
                    {selectedReferenceColumn && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setSelectedReferenceColumn(null)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Rules List */}
                {automationRules.map((rule, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Rule {index + 1}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeRule(index)}
                        className="gap-2 text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                        Remove
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Condition</Label>
                        <Select
                          value={rule.rule_type}
                          onValueChange={(value: any) => updateRule(index, { rule_type: value })}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equals">Equals</SelectItem>
                            <SelectItem value="contains">Contains</SelectItem>
                            <SelectItem value="greater_than">Greater than</SelectItem>
                            <SelectItem value="less_than">Less than</SelectItem>
                            <SelectItem value="greater_equal">Greater or equal</SelectItem>
                            <SelectItem value="less_equal">Less or equal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label className="text-xs">Value</Label>
                        <Input
                          className="h-8"
                          value={rule.condition_value}
                          onChange={(e) => updateRule(index, { condition_value: e.target.value })}
                          placeholder="Condition value"
                        />
                      </div>
                      
                      <div>
                        <Label className="text-xs">Result</Label>
                        <Input
                          className="h-8"
                          value={rule.result_value}
                          onChange={(e) => updateRule(index, { result_value: e.target.value })}
                          placeholder="Result value"
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`strict-${index}`}
                        checked={rule.strict_mode}
                        onCheckedChange={(checked) => updateRule(index, { strict_mode: !!checked })}
                      />
                      <Label htmlFor={`strict-${index}`} className="text-sm">
                        Strict mode (case-sensitive)
                      </Label>
                    </div>
                  </div>
                ))}

                {/* Default Value */}
                <div className="space-y-2">
                  <Label htmlFor="defaultValue">Default Value</Label>
                  <Input
                    id="defaultValue"
                    value={defaultValue}
                    onChange={(e) => setDefaultValue(e.target.value)}
                    placeholder="Value to use when no rules match"
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Updating...' : 'Update Column'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reference Column Picker */}
      <ColumnReferencePicker
        open={showReferencePicker}
        onOpenChange={setShowReferencePicker}
        onColumnSelect={handleReferenceColumnSelect}
        selectedColumnId={selectedReferenceColumn?.id}
        currentTableId={column?.sheet_id}
      />
    </>
  );
}
