import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';
import {
  UserPlus,
  MoreHorizontal,
  Trash2,
  Settings,
  Crown,
  Shield,
  Edit,
  Users,
  Eye,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Member {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'editor' | 'contributor' | 'viewer';
  email?: string;
  joined_at: string;
  invited_by: string;
}

interface MemberManagementProps {
  projectId: string;
  currentUserRole: string;
  onMembersChange?: () => void;
}

const ROLE_COLORS = {
  owner: 'bg-purple-100 text-purple-800',
  admin: 'bg-red-100 text-red-800',
  editor: 'bg-blue-100 text-blue-800',
  contributor: 'bg-green-100 text-green-800',
  viewer: 'bg-gray-100 text-gray-800',
};

const ROLE_ICONS = {
  owner: Crown,
  admin: Shield,
  editor: Edit,
  contributor: Users,
  viewer: Eye,
};

const ROLE_DESCRIPTIONS = {
  owner: 'Full control - can delete project and manage all aspects',
  admin: 'Manage members, change structure, create snapshots',
  editor: 'Add/edit/delete rows, use AI features, cannot change schema',
  contributor: 'Fill data, use AI fill, cannot edit column settings',
  viewer: 'Read-only access, can export if allowed',
};

export function MemberManagement({ projectId, currentUserRole, onMembersChange }: MemberManagementProps) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('viewer');
  const [inviteLoading, setInviteLoading] = useState(false);

  const canManageMembers = ['owner', 'admin'].includes(currentUserRole);

  useEffect(() => {
    fetchMembers();
  }, [projectId]);

  const fetchMembers = async () => {
    if (!user || !projectId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-members', {
        body: {
          action: 'list',
          project_id: projectId,
        },
      });

      if (error) {
        console.error('Error fetching members:', error);
        toast.error('Failed to fetch project members');
        return;
      }

      if (data?.data?.members) {
        setMembers(data.data.members);
      }
    } catch (error: any) {
      console.error('Error fetching members:', error);
      toast.error('Failed to fetch project members');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail || !inviteRole || !projectId) {
      toast.error('Please fill in all fields');
      return;
    }

    setInviteLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-members', {
        body: {
          action: 'invite',
          project_id: projectId,
          email: inviteEmail,
          role: inviteRole,
        },
      });

      if (error) {
        console.error('Error inviting member:', error);
        toast.error(data?.error?.message || 'Failed to invite member');
        return;
      }

      toast.success(`Successfully invited ${inviteEmail} as ${inviteRole}`);
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRole('viewer');
      fetchMembers();
      onMembersChange?.();
    } catch (error: any) {
      console.error('Error inviting member:', error);
      toast.error('Failed to invite member');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberEmail?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-members', {
        body: {
          action: 'remove',
          project_id: projectId,
          member_id: memberId,
        },
      });

      if (error) {
        console.error('Error removing member:', error);
        toast.error(data?.error?.message || 'Failed to remove member');
        return;
      }

      toast.success(`Successfully removed ${memberEmail || 'member'} from project`);
      fetchMembers();
      onMembersChange?.();
    } catch (error: any) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member');
    }
  };

  const handleChangeRole = async (memberId: string, newRole: string, memberEmail?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-members', {
        body: {
          action: 'change_role',
          project_id: projectId,
          member_id: memberId,
          new_role: newRole,
        },
      });

      if (error) {
        console.error('Error changing member role:', error);
        toast.error(data?.error?.message || 'Failed to change member role');
        return;
      }

      toast.success(`Successfully changed ${memberEmail || 'member'} role to ${newRole}`);
      fetchMembers();
      onMembersChange?.();
    } catch (error: any) {
      console.error('Error changing member role:', error);
      toast.error('Failed to change member role');
    }
  };

  const getRoleIcon = (role: string) => {
    const IconComponent = ROLE_ICONS[role as keyof typeof ROLE_ICONS] || Users;
    return <IconComponent className="h-4 w-4" />;
  };

  const availableRoles = currentUserRole === 'owner' 
    ? ['admin', 'editor', 'contributor', 'viewer']
    : ['editor', 'contributor', 'viewer'];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Project Members</h3>
          <p className="text-sm text-gray-600">
            Manage who can access this project and their permissions
          </p>
        </div>
        {canManageMembers && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite New Member</DialogTitle>
                <DialogDescription>
                  Send an invitation to collaborate on this project. The user must already have an account.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          <div className="flex items-center gap-2">
                            {getRoleIcon(role)}
                            <span className="capitalize">{role}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {inviteRole && (
                    <p className="text-sm text-gray-600 mt-1">
                      {ROLE_DESCRIPTIONS[inviteRole as keyof typeof ROLE_DESCRIPTIONS]}
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setInviteOpen(false)}
                  disabled={inviteLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleInviteMember}
                  disabled={inviteLoading || !inviteEmail || !inviteRole}
                >
                  {inviteLoading ? 'Inviting...' : 'Send Invitation'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              {canManageMembers && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canManageMembers ? 4 : 3} className="text-center py-8 text-gray-500">
                  No members found
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => {
                const isCurrentUser = member.user_id === user?.id;
                const canModify = canManageMembers && !isCurrentUser;
                
                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-blue-700">
                            {(member.email || 'U').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">
                            {member.email || 'Unknown User'}
                            {isCurrentUser && <span className="text-sm text-gray-500 ml-1">(You)</span>}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={ROLE_COLORS[member.role]} variant="secondary">
                        <span className="flex items-center gap-1">
                          {getRoleIcon(member.role)}
                          <span className="capitalize">{member.role}</span>
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">
                        {new Date(member.joined_at).toLocaleDateString()}
                      </span>
                    </TableCell>
                    {canManageMembers && (
                      <TableCell>
                        {canModify ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {/* TODO: Implement role change dialog */}}
                              >
                                <Settings className="h-4 w-4 mr-2" />
                                Change Role
                              </DropdownMenuItem>
                              {member.role !== 'owner' && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem
                                      className="text-red-600 focus:text-red-600"
                                      onSelect={(e) => e.preventDefault()}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Remove Member
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Remove Member</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to remove {member.email} from this project?
                                        They will lose access immediately and this action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-red-600 hover:bg-red-700"
                                        onClick={() => handleRemoveMember(member.id, member.email)}
                                      >
                                        Remove Member
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Role Permissions Guide */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">Role Permissions</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(ROLE_DESCRIPTIONS).map(([role, description]) => (
            <div key={role} className="flex items-start gap-2">
              <Badge className={ROLE_COLORS[role as keyof typeof ROLE_COLORS]} variant="secondary">
                <span className="flex items-center gap-1">
                  {getRoleIcon(role)}
                  <span className="capitalize">{role}</span>
                </span>
              </Badge>
              <p className="text-xs text-gray-600 flex-1">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}