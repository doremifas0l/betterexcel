import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Plus, Database, FolderOpen, Table2 } from 'lucide-react'

// Simple test component to isolate dialog behavior without any API calls or auth
export function SimpleFormTest() {
  const [showMainDialog, setShowMainDialog] = useState(false)
  const [showSecondDialog, setShowSecondDialog] = useState(false)
  const [debugLog, setDebugLog] = useState([])

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString()
    const logEntry = `${timestamp}: ${message}`
    setDebugLog(prev => [...prev, logEntry])
    console.log(`SimpleFormTest: ${message}`)
  }

  const openMainDialog = () => {
    addLog('Opening main dialog')
    setShowMainDialog(true)
    addLog('Main dialog state set to true')
  }

  const openSecondDialog = () => {
    addLog('Opening second dialog')
    setShowSecondDialog(true)
    addLog('Second dialog state set to true')
  }

  const closeSecondDialog = () => {
    addLog('Closing second dialog')
    setShowSecondDialog(false)
    addLog('Second dialog state set to false')
  }

  const closeMainDialog = () => {
    addLog('Closing main dialog')
    setShowMainDialog(false)
    setShowSecondDialog(false) // Close both dialogs
    addLog('Both dialogs closed')
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Simple Form Dialog Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button onClick={openMainDialog} variant="default">
              <Plus className="h-4 w-4 mr-2" />
              Add Question (Simple Test)
            </Button>
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <span>Dialog States:</span>
            <span className={`px-3 py-1 rounded-full ${showMainDialog ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              Main: {showMainDialog ? 'OPEN' : 'CLOSED'}
            </span>
            <span className={`px-3 py-1 rounded-full ${showSecondDialog ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
              Second: {showSecondDialog ? 'OPEN' : 'CLOSED'}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Debug Log ({debugLog.length} entries)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-50 border rounded p-4 max-h-60 overflow-y-auto">
            <div className="font-mono text-sm space-y-1">
              {debugLog.length === 0 ? (
                <div className="text-gray-500 italic">No events yet...</div>
              ) : (
                debugLog.map((log, index) => (
                  <div key={index} className="text-slate-700">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Dialog */}
      <Dialog open={showMainDialog} onOpenChange={setShowMainDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Question Dialog</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="question">Question Text</Label>
              <Input 
                id="question" 
                placeholder="What would you like to ask?" 
                onChange={(e) => addLog(`Question text changed: ${e.target.value}`)}
              />
            </div>

            <div className="p-4 border rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground mb-3">Choose data storage location:</p>
              <Button 
                variant="outline" 
                onClick={openSecondDialog}
                className="w-full"
              >
                <Database className="h-4 w-4 mr-2" />
                Select Column
              </Button>
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={closeMainDialog}>
              Cancel
            </Button>
            <Button onClick={() => addLog('Question saved (simulation)')}>
              Save Question
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Second Dialog */}
      <Dialog open={showSecondDialog} onOpenChange={setShowSecondDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Select Column</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              This is the second dialog that should appear over the first dialog.
            </p>
            
            <div className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                onClick={() => {
                  addLog('Column selected: Test Column')
                  closeSecondDialog()
                }}
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                Test Project → Test Table → Test Column
              </Button>
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button variant="outline" onClick={closeSecondDialog}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
