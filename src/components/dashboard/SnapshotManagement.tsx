import React, { useState, useEffect } from 'react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Camera,
  Download,
  MoreHorizontal,
  Trash2,
  Plus,
  RefreshCw,
  History,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

interface Snapshot {
  id: string;
  snapshot_name: string;
  note?: string;
  created_by: string;
  creator_email?: string;
  created_at: string;
  formatted_created_at: string;
}

interface SnapshotStats {
  tables: number;
  total_rows: number;
}

interface SnapshotManagementProps {
  projectId: string;
  onSnapshotCreated?: () => void;
  onSnapshotRestored?: () => void;
}

export function SnapshotManagement({ 
  projectId, 
  onSnapshotCreated, 
  onSnapshotRestored 
}: SnapshotManagementProps) {
  const { user } = useAuth();
  const { canCreateSnapshots, canView } = usePermissions(projectId);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotNote, setSnapshotNote] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState('');

  useEffect(() => {
    if (canView) {
      fetchSnapshots();
    }
  }, [projectId, canView]);

  const fetchSnapshots = async () => {
    if (!user || !projectId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('snapshot-manager', {
        body: {
          action: 'list',
          project_id: projectId,
          limit: 20,
        },
      });

      if (error) {
        console.error('Error fetching snapshots:', error);
        toast.error('Failed to fetch snapshots');
        return;
      }

      if (data?.data?.snapshots) {
        setSnapshots(data.data.snapshots);
      }
    } catch (error: any) {
      console.error('Error fetching snapshots:', error);
      toast.error('Failed to fetch snapshots');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSnapshot = async () => {
    if (!snapshotName.trim()) {
      toast.error('Please provide a name for the snapshot');
      return;
    }

    setCreateLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('snapshot-manager', {
        body: {
          action: 'create',
          project_id: projectId,
          snapshot_name: snapshotName.trim(),
          note: snapshotNote.trim() || null,
        },
      });

      if (error) {
        console.error('Error creating snapshot:', error);
        toast.error(data?.error?.message || 'Failed to create snapshot');
        return;
      }

      const result = data.data;
      toast.success(`Snapshot "${result.snapshot.snapshot_name}" created successfully!`);
      
      setCreateOpen(false);
      setSnapshotName('');
      setSnapshotNote('');
      fetchSnapshots();
      onSnapshotCreated?.();
    } catch (error: any) {
      console.error('Error creating snapshot:', error);
      toast.error('Failed to create snapshot');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleRestoreSnapshot = async (snapshotId: string, snapshotName: string) => {
    setRestoreLoading(snapshotId);
    try {
      const { data, error } = await supabase.functions.invoke('snapshot-manager', {
        body: {
          action: 'restore',
          project_id: projectId,
          snapshot_id: snapshotId,
        },
      });

      if (error) {
        console.error('Error restoring snapshot:', error);
        toast.error(data?.error?.message || 'Failed to restore snapshot');
        return;
      }

      const result = data.data;
      toast.success(
        `Successfully restored from snapshot "${snapshotName}". ` +
        `Restored ${result.stats.tables} tables with ${result.stats.rows} total rows.`
      );
      
      onSnapshotRestored?.();
    } catch (error: any) {
      console.error('Error restoring snapshot:', error);
      toast.error('Failed to restore snapshot');
    } finally {
      setRestoreLoading('');
    }
  };

  const handleDeleteSnapshot = async (snapshotId: string, snapshotName: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('snapshot-manager', {
        body: {
          action: 'delete',
          project_id: projectId,
          snapshot_id: snapshotId,
        },
      });

      if (error) {
        console.error('Error deleting snapshot:', error);
        toast.error(data?.error?.message || 'Failed to delete snapshot');
        return;
      }

      toast.success(`Snapshot "${snapshotName}" deleted successfully`);
      fetchSnapshots();
    } catch (error: any) {
      console.error('Error deleting snapshot:', error);
      toast.error('Failed to delete snapshot');
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      if (days < 7) {
        return `${days} day${days > 1 ? 's' : ''} ago`;
      } else {
        return date.toLocaleDateString();
      }
    }
  };

  if (!canView) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg">
        <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
        <p className="text-gray-600">
          You need view permissions to see snapshots.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Project Snapshots
          </h3>
          <p className="text-sm text-gray-600">
            Create backups and restore your project to previous states
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSnapshots}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {canCreateSnapshots && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Snapshot
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Project Snapshot</DialogTitle>
                  <DialogDescription>
                    Create a complete backup of your project including all tables, data, and configurations.
                    This process may take a few moments for large projects.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="snapshot-name">Snapshot Name</Label>
                    <Input
                      id="snapshot-name"
                      placeholder="e.g., Before major changes"
                      value={snapshotName}
                      onChange={(e) => setSnapshotName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="snapshot-note">Notes (optional)</Label>
                    <Textarea
                      id="snapshot-note"
                      placeholder="Describe what this snapshot contains or why it was created..."
                      value={snapshotNote}
                      onChange={(e) => setSnapshotNote(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setCreateOpen(false)}
                    disabled={createLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateSnapshot}
                    disabled={createLoading || !snapshotName.trim()}
                  >
                    {createLoading ? 'Creating...' : 'Create Snapshot'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Safety Warning */}
      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-yellow-900">Snapshot Safety Guidelines</h4>
              <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                <li>• Snapshots capture the complete project state at creation time</li>
                <li>• Restoring a snapshot will replace ALL current data and structure</li>
                <li>• Consider creating a snapshot before major changes or AI operations</li>
                <li>• Snapshots include member permissions and project settings</li>
                <li>• Large projects may take several minutes to snapshot or restore</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Snapshots List */}
      <div className="space-y-4">
        {loading && snapshots.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : snapshots.length === 0 ? (
          <Card>
            <CardContent className="text-center p-8">
              <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Snapshots Yet</h4>
              <p className="text-gray-600 mb-4">
                Create your first snapshot to backup your project state.
              </p>
              {canCreateSnapshots && (
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Snapshot
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {snapshots.map((snapshot) => {
              const isRestoring = restoreLoading === snapshot.id;
              
              return (
                <Card key={snapshot.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Camera className="h-4 w-4 text-blue-600" />
                          <CardTitle className="text-lg">{snapshot.snapshot_name}</CardTitle>
                          <Badge variant="outline" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatTimeAgo(snapshot.created_at)}
                          </Badge>
                        </div>
                        {snapshot.note && (
                          <CardDescription className="mt-1">
                            {snapshot.note}
                          </CardDescription>
                        )}
                      </div>
                      
                      {canCreateSnapshots && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  onSelect={(e) => e.preventDefault()}
                                  disabled={isRestoring}
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Restore from This Snapshot
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                                    Restore Project from Snapshot
                                  </AlertDialogTitle>
                                  <AlertDialogDescription className="space-y-2">
                                    <p>
                                      This will restore your project to the state captured in 
                                      <strong> "{snapshot.snapshot_name}"</strong> created on{' '}
                                      {snapshot.formatted_created_at}.
                                    </p>
                                    <div className="bg-red-50 border border-red-200 rounded p-3">
                                      <p className="text-red-800 font-medium text-sm">
                                        ⚠️ WARNING: This action will:
                                      </p>
                                      <ul className="text-red-700 text-sm mt-1 space-y-1">
                                        <li>• Replace ALL current data, tables, and columns</li>
                                        <li>• Reset member roles and permissions</li>
                                        <li>• Cannot be undone without another snapshot</li>
                                      </ul>
                                    </div>
                                    <p className="text-sm">
                                      Consider creating a snapshot of the current state before proceeding.
                                    </p>
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-600 hover:bg-red-700"
                                    onClick={() => handleRestoreSnapshot(snapshot.id, snapshot.snapshot_name)}
                                  >
                                    Restore Project
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onSelect={(e) => e.preventDefault()}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Snapshot
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Snapshot</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete the snapshot "{snapshot.snapshot_name}"?
                                    This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-600 hover:bg-red-700"
                                    onClick={() => handleDeleteSnapshot(snapshot.id, snapshot.snapshot_name)}
                                  >
                                    Delete Snapshot
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {snapshot.creator_email || 'Unknown user'}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {snapshot.formatted_created_at}
                      </div>
                    </div>
                    
                    {isRestoring && (
                      <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
                        <div className="flex items-center gap-2 text-sm text-blue-800">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          Restoring from snapshot... This may take several minutes.
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}