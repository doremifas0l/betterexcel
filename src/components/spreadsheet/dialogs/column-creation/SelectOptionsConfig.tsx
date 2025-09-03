import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

interface SelectOption {
    value: string;
    label: string;
}

interface SelectOptionsConfigProps {
    options: SelectOption[];
    onOptionChange: (index: number, field: 'value' | 'label', value: string) => void;
    onAddOption: () => void;
    onRemoveOption: (index: number) => void;
}

export function SelectOptionsConfig({ options, onOptionChange, onAddOption, onRemoveOption }: SelectOptionsConfigProps) {
    return (
        <Card>
            <CardHeader className="pb-4">
                <CardTitle className="text-base">Select Options</CardTitle>
                <CardDescription>
                    Define the available options for this select field.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <Input
                            value={option.value}
                            onChange={(e) => onOptionChange(index, 'value', e.target.value)}
                            placeholder="Value (e.g., in_progress)"
                        />
                        <Input
                            value={option.label}
                            onChange={(e) => onOptionChange(index, 'label', e.target.value)}
                            placeholder="Label (e.g., In Progress)"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => onRemoveOption(index)}
                            disabled={options.length <= 1}
                            className="text-destructive"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
                <Button
                    type="button"
                    variant="outline"
                    onClick={onAddOption}
                    className="w-full"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Option
                </Button>
            </CardContent>
        </Card>
    );
}