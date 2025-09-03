import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Settings, Home, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LeftSidebar } from '@/components/layout/LeftSidebar'
import { EnhancedTableCreationDialog } from '@/components/spreadsheet/EnhancedTableCreationDialog'
import { ProjectSettingsModal } from '@/components/dashboard/dialogs/ProjectSettingsModal'
import { useProjects } from '@/hooks/data/useProjects'
import { Project } from '@/lib/supabase'
import { useEffect } from 'react'

interface ProjectLayoutProps {
  children: React.ReactNode
  currentTableId?: string
}

export function ProjectLayout({ children, currentTableId }: ProjectLayoutProps) {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { fetchProjects } = useProjects()
  
  const [project, setProject] = useState<Project | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showProjectSettings, setShowProjectSettings] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    if (projectId) {
      loadProject()
    }
  }, [projectId])

  const loadProject = async () => {
    const projects = await fetchProjects()
    const currentProject = projects.find(p => p.id === projectId)
    setProject(currentProject || null)
  }

  const handleTableCreated = () => {
    // Trigger refresh of sidebar table list
    setRefreshTrigger(prev => prev + 1)
  }

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-4">Invalid project</h2>
          <Button onClick={() => navigate('/')}>
            Back to Projects
          </Button>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between h-14 px-4">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/')}
              className="text-gray-500 hover:text-gray-700"
            >
              <Home className="h-4 w-4" />
            </Button>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <span className="font-medium text-gray-900">{project.name}</span>
            {currentTableId && (
              <>
                <ChevronRight className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">Table View</span>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline"
              size="sm"
              onClick={() => setShowProjectSettings(true)}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Project Settings
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <LeftSidebar
          projectId={projectId}
          currentTableId={currentTableId}
          isCollapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          onCreateTable={() => setShowCreateDialog(true)}
          refreshTrigger={refreshTrigger}
        />

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>

      {/* Modals */}
      <EnhancedTableCreationDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        projectId={projectId}
        onTableCreated={handleTableCreated}
      />

      {project && (
        <ProjectSettingsModal
          open={showProjectSettings}
          onOpenChange={setShowProjectSettings}
          project={project}
          onProjectUpdated={loadProject}
        />
      )}
    </div>
  )
}
