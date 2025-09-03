import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Wand2,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lightbulb,
  Settings,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { usePermissions } from '@/hooks/usePermissions';

interface AIRule {
  id: string;
  column_id: string;
  rule_type: 'computed' | 'validation' | 'formatting';
  rule_definition: any;
  natural_language_description: string;
  is_active: boolean;
  created_at: string;
}

interface AIFeaturesProps {
  projectId: string;
  columnId?: string;
  columnName?: string;
  onRuleCreated?: () => void;
}

export function AIFeatures({ projectId, columnId, columnName, onRuleCreated }: AIFeaturesProps) {
  const { user } = useAuth();
  const { canCreateAIRules, canUseAI } = usePermissions(projectId);
  const [ruleBuilderOpen, setRuleBuilderOpen] = useState(false);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [fillOpen, setFillOpen] = useState(false);
  const [naturalDescription, setNaturalDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedRule, setGeneratedRule] = useState<any>(null);
  const [cleanupData, setCleanupData] = useState('');
  const [cleanupOperation, setCleanupOperation] = useState('title_case');
  const [cleanupSuggestions, setCleanupSuggestions] = useState<any[]>([]);
  const [fillData, setFillData] = useState('');
  const [fillSourceTable, setFillSourceTable] = useState('');
  const [fillSuggestions, setFillSuggestions] = useState<any[]>([]);

  const handleCreateRule = async () => {
    if (!naturalDescription || !columnId) {
      toast.error('Please provide a description for the AI rule');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-processor', {
        body: {
          action: 'create_rule',
          project_id: projectId,
          column_id: columnId,
          natural_description: naturalDescription,
        },
      });

      if (error) {
        console.error('Error creating AI rule:', error);
        toast.error(data?.error?.message || 'Failed to create AI rule');
        return;
      }

      const result = data.data;
      setGeneratedRule(result.ai_generated);
      toast.success('AI rule created successfully! Review and activate when ready.');
      onRuleCreated?.();
    } catch (error: any) {
      console.error('Error creating AI rule:', error);
      toast.error('Failed to create AI rule');
    } finally {
      setLoading(false);
    }
  };

  const handleCleanupData = async () => {
    if (!cleanupData || !cleanupOperation) {
      toast.error('Please provide data to clean and select an operation');
      return;
    }

    setLoading(true);
    try {
      const dataArray = cleanupData.split('\n').filter(line => line.trim());
      
      const { data, error } = await supabase.functions.invoke('ai-processor', {
        body: {
          action: 'cleanup_data',
          project_id: projectId,
          data: dataArray,
          operation_type: cleanupOperation,
        },
      });

      if (error) {
        console.error('Error cleaning data:', error);
        toast.error(data?.error?.message || 'Failed to clean data');
        return;
      }

      const result = data.data;
      setCleanupSuggestions(result.suggestions || []);
      toast.success('Data cleanup suggestions generated!');
    } catch (error: any) {
      console.error('Error cleaning data:', error);
      toast.error('Failed to clean data');
    } finally {
      setLoading(false);
    }
  };

  const handleFillData = async () => {
    if (!fillData || !fillSourceTable) {
      toast.error('Please provide data to fill and select a source table');
      return;
    }

    setLoading(true);
    try {
      const dataArray = fillData.split('\n').filter(line => line.trim());
      
      const { data, error } = await supabase.functions.invoke('ai-processor', {
        body: {
          action: 'fill_data',
          project_id: projectId,
          data: dataArray,
          source_table: fillSourceTable,
        },
      });

      if (error) {
        console.error('Error filling data:', error);
        toast.error(data?.error?.message || 'Failed to fill data');
        return;
      }

      const result = data.data;
      setFillSuggestions(result.suggestions || []);
      toast.success('Data fill suggestions generated!');
    } catch (error: any) {
      console.error('Error filling data:', error);
      toast.error('Failed to fill data');
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.9) return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (confidence >= 0.7) return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    return <XCircle className="h-4 w-4 text-red-600" />;
  };

  if (!canUseAI && !canCreateAIRules) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg">
        <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">AI Features Not Available</h3>
        <p className="text-gray-600">
          You need contributor permissions or higher to use AI features.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            AI-Powered Features
          </h3>
          <p className="text-sm text-gray-600">
            Use AI to create rules, clean data, and fill missing information
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* AI Rule Builder */}
        {canCreateAIRules && columnId && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-blue-600" />
                Rule Builder
              </CardTitle>
              <CardDescription>
                Create AI-powered column rules using natural language
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog open={ruleBuilderOpen} onOpenChange={setRuleBuilderOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full">
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Create Rule for {columnName}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>AI Rule Builder for {columnName}</DialogTitle>
                    <DialogDescription>
                      Describe the rule you want in plain English, and AI will convert it to a working formula.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="description">Rule Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Example: Grade Bucket: A if Percent >= 85; B if >= 70; else C"
                        value={naturalDescription}
                        onChange={(e) => setNaturalDescription(e.target.value)}
                        rows={3}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Examples: "Must be between 0 and 100", "Title case all text", "Calculate total from quantity * price"
                      </p>
                    </div>
                    
                    {generatedRule && (
                      <Card className="bg-blue-50">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Generated Rule Preview</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div>
                            <Badge variant="outline">
                              {generatedRule.rule_type}
                            </Badge>
                          </div>
                          <p className="text-sm">{generatedRule.summary}</p>
                          {generatedRule.formula && (
                            <div className="bg-white p-2 rounded border text-xs font-mono">
                              {generatedRule.formula}
                            </div>
                          )}
                          {generatedRule.conditions && generatedRule.conditions.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium">Conditions:</p>
                              {generatedRule.conditions.map((condition: any, index: number) => (
                                <div key={index} className="text-xs bg-white p-1 rounded border">
                                  {condition.condition} → {condition.value}
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setRuleBuilderOpen(false);
                        setGeneratedRule(null);
                        setNaturalDescription('');
                      }}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateRule}
                      disabled={loading || !naturalDescription}
                    >
                      {loading ? 'Creating...' : 'Generate Rule'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        )}

        {/* AI Data Cleanup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-green-600" />
              Data Cleanup
            </CardTitle>
            <CardDescription>
              Clean and normalize messy data using AI
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={cleanupOpen} onOpenChange={setCleanupOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Cleanup Data
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>AI Data Cleanup</DialogTitle>
                  <DialogDescription>
                    Paste your messy data and select a cleanup operation. AI will suggest improvements.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="cleanup-operation">Cleanup Operation</Label>
                      <Select value={cleanupOperation} onValueChange={setCleanupOperation}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="title_case">Title Case Names</SelectItem>
                          <SelectItem value="normalize_codes">Normalize Codes</SelectItem>
                          <SelectItem value="split_names">Split Full Names</SelectItem>
                          <SelectItem value="clean_emails">Clean Email Addresses</SelectItem>
                          <SelectItem value="format_phones">Format Phone Numbers</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="cleanup-data">Data to Clean (one value per line)</Label>
                    <Textarea
                      id="cleanup-data"
                      placeholder="john doe\nJANE SMITH\nbob johnson\n..."
                      value={cleanupData}
                      onChange={(e) => setCleanupData(e.target.value)}
                      rows={8}
                    />
                  </div>

                  {cleanupSuggestions.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Cleanup Suggestions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {cleanupSuggestions.map((suggestion, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-600">{suggestion.original}</span>
                                  <span>→</span>
                                  <span className="text-sm font-medium">{suggestion.cleaned}</span>
                                  <div className="flex items-center gap-1">
                                    {getConfidenceIcon(suggestion.confidence)}
                                    <span className={`text-xs ${getConfidenceColor(suggestion.confidence)}`}>
                                      {Math.round(suggestion.confidence * 100)}%
                                    </span>
                                  </div>
                                </div>
                                {suggestion.explanation && (
                                  <p className="text-xs text-gray-500 mt-1">{suggestion.explanation}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCleanupOpen(false);
                      setCleanupSuggestions([]);
                      setCleanupData('');
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCleanupData}
                    disabled={loading || !cleanupData}
                  >
                    {loading ? 'Processing...' : 'Generate Suggestions'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* AI Data Fill */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-orange-600" />
              Smart Fill
            </CardTitle>
            <CardDescription>
              Fill missing data using existing tables as reference
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={fillOpen} onOpenChange={setFillOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Play className="h-4 w-4 mr-2" />
                  Fill Missing Data
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>AI Smart Fill</DialogTitle>
                  <DialogDescription>
                    Provide incomplete data and a source table, AI will suggest values to fill missing fields.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="source-table">Source Table ID</Label>
                    <Input
                      id="source-table"
                      placeholder="table-uuid-or-sheet-uuid"
                      value={fillSourceTable}
                      onChange={(e) => setFillSourceTable(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      The table/sheet to use as reference for filling missing data
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="fill-data">Incomplete Data (one record per line)</Label>
                    <Textarea
                      id="fill-data"
                      placeholder="Student ID: 12345, Name: John Doe, Grade: [missing]\nStudent ID: 12346, Name: Jane Smith, Email: [missing]"
                      value={fillData}
                      onChange={(e) => setFillData(e.target.value)}
                      rows={8}
                    />
                  </div>

                  {fillSuggestions.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Fill Suggestions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {fillSuggestions.map((suggestion, index) => (
                            <div key={index} className="p-2 bg-gray-50 rounded">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium">{suggestion.field}</span>
                                <span>→</span>
                                <span className="text-sm">{suggestion.suggested}</span>
                                <div className="flex items-center gap-1">
                                  {getConfidenceIcon(suggestion.confidence)}
                                  <span className={`text-xs ${getConfidenceColor(suggestion.confidence)}`}>
                                    {Math.round(suggestion.confidence * 100)}%
                                  </span>
                                </div>
                              </div>
                              <p className="text-xs text-gray-500">{suggestion.source}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFillOpen(false);
                      setFillSuggestions([]);
                      setFillData('');
                      setFillSourceTable('');
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleFillData}
                    disabled={loading || !fillData || !fillSourceTable}
                  >
                    {loading ? 'Processing...' : 'Generate Suggestions'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      {/* AI Safety Notice */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-blue-900">AI Safety Guidelines</h4>
              <ul className="text-sm text-blue-700 mt-1 space-y-1">
                <li>• Always review AI suggestions before applying them</li>
                <li>• AI respects your data validation rules and constraints</li>
                <li>• Create snapshots before applying large AI changes</li>
                <li>• AI suggestions are based on patterns in your existing data</li>
                <li>• For select columns, AI only suggests from existing options</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}