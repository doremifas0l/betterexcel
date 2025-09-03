import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase'; // Corrected path assumption
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Clock,
  Filter,
  RefreshCw,
  User,
  FileText,
  Users,
  Camera,
  Zap,
  Upload,
  Download,
  Settings,
  Trash2,
  Plus,
  Edit,
  Eye,
  BarChart3,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

// Interfaces remain the same
interface AuditLog {
  id: string;
  project_id: string;
  user_id: string | null;
  user_email: string | null;
  action_type: string;
  target_type: string;
  target_id: string | null;
  details: any;
  timestamp: string;
  formatted_timestamp: string;
  action_summary: string;
}

interface AuditStats {
  total_actions: number;
  recent_actions: number;
  action_types: Record<string, number>;
  active_users: number;
  most_active_user: string;
}

interface AuditTrailProps {
  projectId: string;
}

// Icon and Color mappings remain the same
const ACTION_ICONS: Record<string, React.ComponentType<any>> = {
  row_created: Plus, row_updated: Edit, row_deleted: Trash2,
  column_created: Plus, column_updated: Edit, column_deleted: Trash2,
  member_invited: Users, member_removed: Users, member_role_changed: Users,
  snapshot_created: Camera, snapshot_restored: Download,
  ai_rule_created: Zap, ai_rule_activated: Zap, ai_cleanup_applied: Zap, ai_fill_applied: Zap,
  bulk_paste: Upload, bulk_import: Upload,
  project_settings_updated: Settings,
  table_created: Plus, table_deleted: Trash2,
};

const ACTION_COLORS: Record<string, string> = {
  row_created: 'bg-green-100 text-green-800', row_updated: 'bg-blue-100 text-blue-800', row_deleted: 'bg-red-100 text-red-800',
  column_created: 'bg-green-100 text-green-800', column_updated: 'bg-blue-100 text-blue-800', column_deleted: 'bg-red-100 text-red-800',
  member_invited: 'bg-purple-100 text-purple-800', member_removed: 'bg-red-100 text-red-800', member_role_changed: 'bg-yellow-100 text-yellow-800',
  snapshot_created: 'bg-indigo-100 text-indigo-800', snapshot_restored: 'bg-indigo-100 text-indigo-800',
  ai_rule_created: 'bg-violet-100 text-violet-800', ai_rule_activated: 'bg-violet-100 text-violet-800', ai_cleanup_applied: 'bg-violet-100 text-violet-800', ai_fill_applied: 'bg-violet-100 text-violet-800',
  bulk_paste: 'bg-orange-100 text-orange-800', bulk_import: 'bg-orange-100 text-orange-800',
  project_settings_updated: 'bg-gray-100 text-gray-800',
  table_created: 'bg-green-100 text-green-800', table_deleted: 'bg-red-100 text-red-800',
};

export function AuditTrail({ projectId }: AuditTrailProps) {
  const { user } = useAuth();
  // Assuming your usePermissions hook returns this shape.
  const permissions = usePermissions(projectId); 
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterUser, setFilterUser] = useState('');
  // --- FIX #1: Initialize state with 'all' instead of '' ---
  const [filterTarget, setFilterTarget] = useState('all');
  const [limit, setLimit] = useState(50);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (permissions.canView) {
      fetchLogs();
      fetchStats();
    }
  }, [projectId, permissions.canView]);

  const fetchLogs = async (offset = 0, append = false) => {
    if (!user || !projectId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('audit-logger', {
        body: {
          action: 'get_timeline',
          project_id: projectId,
          limit,
          offset,
          user_id: filterUser || undefined,
          // --- FIX #2: If filter is 'all', send undefined to the backend ---
          target_type: filterTarget === 'all' ? undefined : filterTarget,
        },
      });

      if (error) throw error;

      if (data?.data?.logs) {
        if (append) {
          setLogs(prev => [...prev, ...data.data.logs]);
        } else {
          setLogs(data.data.logs);
        }
        setHasMore(data.data.has_more || false);
      }
    } catch (error: any) {
      console.error('Error fetching audit logs:', error);
      toast.error('Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!user || !projectId) return;
    try {
      const { data, error } = await supabase.functions.invoke('audit-logger', {
        body: { action: 'get_stats', project_id: projectId },
      });
      if (error) throw error;
      if (data?.data) setStats(data.data);
    } catch (error: any) {
      console.error('Error fetching audit stats:', error);
    }
  };

  const handleRefresh = () => {
    fetchLogs();
    fetchStats();
  };

  const handleLoadMore = () => {
    fetchLogs(logs.length, true);
  };

  const getActionIcon = (actionType: string) => {
    const IconComponent = ACTION_ICONS[actionType] || FileText;
    return <IconComponent className="h-4 w-4" />;
  };

  const getActionColor = (actionType: string) => {
    return ACTION_COLORS[actionType] || 'bg-gray-100 text-gray-800';
  };

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const diff = (new Date().getTime() - date.getTime()) / 1000;
    if (diff < 60) return 'Just now';
    const minutes = Math.floor(diff / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(diff / 3600);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(diff / 86400);
    return `${days}d ago`;
  };

  if (!permissions.canView) {
    return (
      <Card>
        <CardContent className="text-center p-8">
          <Eye className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium">Access Denied</h3>
          <p className="text-gray-600">You need view permissions to see the audit trail.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Total Actions</p><p className="text-2xl font-bold">{stats.total_actions}</p></div><FileText className="h-8 w-8 text-blue-600" /></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Recent (24h)</p><p className="text-2xl font-bold">{stats.recent_actions}</p></div><Clock className="h-8 w-8 text-green-600" /></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Active Users</p><p className="text-2xl font-bold">{stats.active_users}</p></div><Users className="h-8 w-8 text-purple-600" /></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Action Types</p><p className="text-2xl font-bold">{Object.keys(stats.action_types).length}</p></div><BarChart3 className="h-8 w-8 text-orange-600" /></div></CardContent></Card>
        </div>
      )}

      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Activity Timeline</CardTitle>
              <CardDescription>Complete history of all actions in this project</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}><RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Filter className="h-4 w-4 text-gray-500" />
            <div className="flex items-center gap-2">
              <Label htmlFor="filter-user" className="text-sm">User:</Label>
              <Input id="filter-user" placeholder="Filter by email" value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="w-48" />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="filter-target" className="text-sm">Type:</Label>
              <Select value={filterTarget} onValueChange={setFilterTarget}>
                <SelectTrigger className="w-32"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  {/* --- FIX #3: Use 'all' as the value instead of '' --- */}
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="row">Rows</SelectItem>
                  <SelectItem value="column">Columns</SelectItem>
                  <SelectItem value="user">Members</SelectItem>
                  <SelectItem value="snapshot">Snapshots</SelectItem>
                  <SelectItem value="ai_rule">AI Rules</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchLogs(0, false)} disabled={loading}>Apply Filters</Button>
          </div>
          <Separator className="mb-4" />
          <div className="space-y-4">
            {loading && logs.length === 0 ? (
              <div className="text-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></div>
            ) : logs.length === 0 ? (
              <div className="text-center p-8 text-gray-500"><FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" /><p>No activity found for the selected filters</p></div>
            ) : (
              <>
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0"><div className="w-8 h-8 bg-white rounded-full flex items-center justify-center border">{getActionIcon(log.action_type)}</div></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge className={getActionColor(log.action_type)} variant="secondary">{log.action_type.replace(/_/g, ' ')}</Badge>
                        <span className="text-sm text-gray-600">{formatTimeAgo(log.timestamp)}</span>
                        {log.user_email && <div className="flex items-center gap-1 text-sm text-gray-600"><User className="h-3 w-3" />{log.user_email}</div>}
                      </div>
                      <p className="text-sm font-medium text-gray-900">{log.action_summary}</p>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <div className="mt-2 p-2 bg-white rounded border text-xs">
                          <details>
                            <summary className="cursor-pointer text-gray-600 hover:text-gray-900">View details</summary>
                            <pre className="mt-2 text-gray-700 whitespace-pre-wrap">{JSON.stringify(log.details, null, 2)}</pre>
                          </details>
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-1">{log.formatted_timestamp}</p>
                    </div>
                  </div>
                ))}
                {hasMore && <div className="text-center"><Button variant="outline" onClick={handleLoadMore} disabled={loading}>{loading ? 'Loading...' : 'Load More'}</Button></div>}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}