import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Table, Users, Camera, History, Sparkles, 
  FileSpreadsheet, MoreHorizontal, Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { EnhancedTableCreationDialog } from '@/components/spreadsheet/EnhancedTableCreationDialog';
import { MemberManagement } from '@/components/dashboard/MemberManagement';
import { AuditTrail } from '@/components/dashboard/AuditTrail';
import { SnapshotManagement } from '@/components/dashboard/SnapshotManagement';
import { AIFeatures } from '@/components/dashboard/AIFeatures';
import { usePermissions } from '@/hooks/usePermissions';
import { Project, BetterTable } from '@/lib/supabase';
import { toast } from 'sonner';
import { useProjects } from '@/hooks/data/useProjects';
import { useTables } from '@/hooks/data/useTables';
import { FormsAccordionSection } from '@/components/forms/FormsAccordionSection';

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  
  const { fetchProjects } = useProjects();
  const { fetchTables } = useTables();
  const permissions = usePermissions(projectId);

  const [isLoading, setIsLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [tables, setTables] = useState<BetterTable[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const loadProjectAndTables = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const projectsData = await fetchProjects();
      const currentProject = projectsData.find(p => p.id === projectId);
      setProject(currentProject || null);

      if (currentProject) {
        const tableData = await fetchTables(projectId);
        setTables(tableData);
      }
    } catch (error) {
        toast.error("Failed to load project details.");
    } finally {
        setIsLoading(false);
    }
  }, [projectId, fetchProjects, fetchTables]);

  useEffect(() => {
    loadProjectAndTables();
  }, [loadProjectAndTables]);

  const handleTableCreated = () => {
    loadProjectAndTables();
    setShowCreateDialog(false);
  };

  if (isLoading || permissions.loading) {
    return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }
  if (!project) {
    return <div className="text-center py-16"><h2 className="text-xl font-semibold">Project Not Found</h2></div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="p-6 space-y-8">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            <p className="text-muted-foreground mt-1">{project.description || 'No description provided.'}</p>
          </div>
          {permissions.canManageMembers && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Rename Project</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <Tabs defaultValue="assets" className="w-full">
            <TabsList>
                <TabsTrigger value="assets"><Table className="h-4 w-4 mr-2" />Assets</TabsTrigger>
                {permissions.canManageMembers && <TabsTrigger value="members"><Users className="h-4 w-4 mr-2" />Members</TabsTrigger>}
                {permissions.canCreateSnapshots && <TabsTrigger value="snapshots"><Camera className="h-4 w-4 mr-2" />Snapshots</TabsTrigger>}
                <TabsTrigger value="activity"><History className="h-4 w-4 mr-2" />Activity</TabsTrigger>
                {permissions.canUseAI && <TabsTrigger value="ai"><Sparkles className="h-4 w-4 mr-2" />AI Features</TabsTrigger>}
            </TabsList>

            <TabsContent value="assets" className="mt-6">
                <Accordion type="multiple" defaultValue={['tables', 'forms']} className="w-full space-y-4">
                    
                    <AccordionItem value="tables" className="border rounded-lg">
                      <div className="flex items-center justify-between p-4 pl-6">
                        <AccordionTrigger className="flex-1 p-0 text-left hover:no-underline">
                          <div className="flex items-center gap-3">
                            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                            <h2 className="text-lg font-semibold">Tables</h2>
                            <Badge variant="secondary">{tables.length}</Badge>
                          </div>
                        </AccordionTrigger>
                        <Button
                          size="sm"
                          className="ml-4"
                          onClick={(e) => { e.stopPropagation(); setShowCreateDialog(true); }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          New Table
                        </Button>
                      </div>

                      <AccordionContent className="p-6 pt-0">
                        {tables.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed rounded-lg">
                            <h3 className="text-lg font-semibold">No Tables Yet</h3>
                            <p className="text-muted-foreground mt-1">Create your first table to start organizing data.</p>
                            </div>
                        ) : (
                            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {tables.map(table => <TableCard key={table.id} table={table} projectId={projectId!} />)}
                            </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                    
                    <FormsAccordionSection projectId={projectId!} />

                </Accordion>
            </TabsContent>
            
            {permissions.canManageMembers && <TabsContent value="members"><MemberManagement projectId={projectId!} currentUserRole={permissions.userRole || 'viewer'} onMembersChange={permissions.refreshPermissions} /></TabsContent>}
            {permissions.canCreateSnapshots && <TabsContent value="snapshots"><SnapshotManagement projectId={projectId!} onSnapshotRestored={loadProjectAndTables} /></TabsContent>}
            <TabsContent value="activity"><AuditTrail projectId={projectId!} /></TabsContent>
            {permissions.canUseAI && <TabsContent value="ai"><AIFeatures projectId={projectId!} /></TabsContent>}
        </Tabs>

        <EnhancedTableCreationDialog
            open={showCreateDialog}
            onOpenChange={setShowCreateDialog}
            projectId={projectId!}
            onTableCreated={handleTableCreated}
        />
      </div>
    </div>
  );
}

function TableCard({ table, projectId }: { table: BetterTable, projectId: string }) {
  const form_count: number = 0; 
  return (
    <Link to={`/project/${projectId}/table/${table.id}`} className="group block">
      <Card className="h-full flex flex-col hover:shadow-lg transition-shadow duration-200">
        <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary rounded-md"><FileSpreadsheet className="h-5 w-5 text-muted-foreground" /></div>
              <CardTitle className="text-base font-semibold leading-tight">{table.name}</CardTitle>
            </div>
            <CardDescription className="text-xs mt-2 line-clamp-2">{table.description || 'No description'}</CardDescription>
        </CardHeader>
        <CardFooter className="mt-auto pt-4 flex justify-between items-center text-xs text-muted-foreground">
            <span>{table.row_count || 0} rows</span>
            <span>{form_count} form{form_count !== 1 ? 's' : ''}</span>
        </CardFooter>
      </Card>
    </Link>
  );
}