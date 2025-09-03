import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Wand2, TestTube, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface AITestResult {
  feature: string
  success: boolean
  result?: any
  error?: string
  duration?: number
}

export function AIFeaturesTest({ projectId, columnId }: { projectId: string; columnId?: string }) {
  const { user } = useAuth()
  const [testResults, setTestResults] = useState<AITestResult[]>([])
  const [testing, setTesting] = useState(false)
  const [naturalDescription, setNaturalDescription] = useState('Grade Bucket: A if Percent >= 85; B if >= 70; else C')
  const [sampleData, setSampleData] = useState(`[
  {"name": "John", "score": 95, "department": "Sales"},
  {"name": "Jane", "score": 78, "department": "Marketing"},
  {"name": "Bob", "score": 65, "department": "IT"}
]`)

  const testAIFeature = async (feature: string, payload: any): Promise<AITestResult> => {
    const startTime = Date.now()
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-processor', {
        body: payload
      })
      
      const duration = Date.now() - startTime
      
      if (error) {
        return {
          feature,
          success: false,
          error: error.message,
          duration
        }
      }
      
      return {
        feature,
        success: true,
        result: data,
        duration
      }
    } catch (error: any) {
      return {
        feature,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      }
    }
  }

  const runAllTests = async () => {
    if (!user) {
      toast.error('Please sign in to test AI features')
      return
    }

    setTesting(true)
    setTestResults([])
    const results: AITestResult[] = []

    // Test 1: AI Rule Creation
    console.log('Testing AI Rule Creation...')
    const ruleTest = await testAIFeature('AI Rule Creation', {
      action: 'create_rule',
      project_id: projectId,
      column_id: columnId || 'test-column-id',
      natural_description: naturalDescription
    })
    results.push(ruleTest)
    setTestResults([...results])

    // Test 2: AI Data Cleanup
    console.log('Testing AI Data Cleanup...')
    let testData
    try {
      testData = JSON.parse(sampleData)
    } catch {
      testData = [{ name: 'Test', score: 85, department: 'Test Dept' }]
    }
    
    const cleanupTest = await testAIFeature('AI Data Cleanup', {
      action: 'cleanup_data',
      project_id: projectId,
      data: testData,
      operation_type: 'normalize'
    })
    results.push(cleanupTest)
    setTestResults([...results])

    // Test 3: AI Fill Missing Data
    console.log('Testing AI Fill Missing Data...')
    const fillTest = await testAIFeature('AI Fill Missing Data', {
      action: 'fill_missing',
      project_id: projectId,
      data: testData.map(item => ({ ...item, missing_field: null })),
      operation_type: 'intelligent_fill'
    })
    results.push(fillTest)
    setTestResults([...results])

    // Test 4: AI Generate Sample Data
    console.log('Testing AI Generate Sample Data...')
    const generateTest = await testAIFeature('AI Generate Sample Data', {
      action: 'generate_data',
      project_id: projectId,
      data_description: 'Employee evaluation data with names, departments, performance scores, and review status'
    })
    results.push(generateTest)
    setTestResults([...results])

    setTesting(false)
    
    const successCount = results.filter(r => r.success).length
    if (successCount === results.length) {
      toast.success(`All ${successCount} AI features are working correctly!`)
    } else {
      toast.warning(`${successCount}/${results.length} AI features are working. Check failed tests.`)
    }
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-blue-600" />
          AI Features Testing
        </CardTitle>
        <CardDescription>
          Comprehensive testing of all AI features with Gemini API integration
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Test Configuration */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Natural Language Rule Description</label>
            <Textarea
              value={naturalDescription}
              onChange={(e) => setNaturalDescription(e.target.value)}
              placeholder="Describe a rule in natural language..."
              className="h-20"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">Sample Data (JSON)</label>
            <Textarea
              value={sampleData}
              onChange={(e) => setSampleData(e.target.value)}
              placeholder="Enter sample data as JSON array..."
              className="h-32 font-mono text-sm"
            />
          </div>
        </div>

        {/* Test Button */}
        <Button 
          onClick={runAllTests} 
          disabled={testing || !projectId}
          className="w-full"
          size="lg"
        >
          {testing ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Running AI Tests...
            </>
          ) : (
            <>
              <TestTube className="h-5 w-5 mr-2" />
              Run All AI Feature Tests
            </>
          )}
        </Button>

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Test Results
            </h3>
            
            {testResults.map((result, index) => (
              <Card key={index} className={result.success ? 'border-green-200' : 'border-red-200'}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {result.success ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="font-medium">{result.feature}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.duration && (
                        <Badge variant="secondary">{result.duration}ms</Badge>
                      )}
                      <Badge variant={result.success ? 'default' : 'destructive'}>
                        {result.success ? 'PASS' : 'FAIL'}
                      </Badge>
                    </div>
                  </div>
                  
                  {result.error && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded mt-2">
                      <strong>Error:</strong> {result.error}
                    </div>
                  )}
                  
                  {result.result && (
                    <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded mt-2">
                      <strong>Result:</strong>
                      <pre className="mt-1 text-xs overflow-x-auto">
                        {JSON.stringify(result.result, null, 2)}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Instructions */}
        <div className="text-sm text-gray-600 bg-blue-50 p-4 rounded-lg">
          <strong>Test Coverage:</strong>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li><strong>AI Rule Creation:</strong> Convert natural language to structured rules</li>
            <li><strong>AI Data Cleanup:</strong> Normalize and clean messy data</li>
            <li><strong>AI Fill Missing Data:</strong> Intelligently fill in missing values</li>
            <li><strong>AI Generate Sample Data:</strong> Create realistic test data</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
