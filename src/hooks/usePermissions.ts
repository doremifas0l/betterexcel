import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type UserRole = 'owner' | 'admin' | 'editor' | 'contributor' | 'viewer';
export type Permission = 
  | 'view'
  | 'edit_data'
  | 'edit_structure'
  | 'manage_members'
  | 'transfer_ownership'
  | 'delete_project'
  | 'create_snapshots'
  | 'restore_snapshots'
  | 'ai_fill'
  | 'ai_rules';

interface PermissionResult {
  has_permission: boolean;
  user_role: UserRole | null;
  required_level?: number;
  user_level?: number;
  reason?: string;
}

interface UsePermissionsReturn {
  userRole: UserRole | null;
  checkPermission: (permission: Permission) => Promise<boolean>;
  hasPermission: (permission: Permission) => boolean;
  canView: boolean;
  canEditData: boolean;
  canEditStructure: boolean;
  canManageMembers: boolean;
  canCreateSnapshots: boolean;
  canUseAI: boolean;
  canCreateAIRules: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isEditor: boolean;
  isContributor: boolean;
  isViewer: boolean;
  loading: boolean;
  refreshPermissions: () => Promise<void>;
}

const PERMISSION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const globalPermissionCache = new Map<string, { result: PermissionResult; expires: number }>();

export function usePermissions(projectId: string): UsePermissionsReturn {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [localPermissionCache, setLocalPermissionCache] = useState<Map<Permission, boolean>>(new Map());
  const [loading, setLoading] = useState(true);

  // Define permission shortcuts based on role
  const canView = userRole !== null;
  const canEditData = userRole && ['owner', 'admin', 'editor', 'contributor'].includes(userRole);
  const canEditStructure = userRole && ['owner', 'admin'].includes(userRole);
  const canManageMembers = userRole && ['owner', 'admin'].includes(userRole);
  const canCreateSnapshots = userRole && ['owner', 'admin'].includes(userRole);
  const canUseAI = userRole && ['owner', 'admin', 'editor', 'contributor'].includes(userRole);
  const canCreateAIRules = userRole && ['owner', 'admin'].includes(userRole);
  const isOwner = userRole === 'owner';
  const isAdmin = userRole === 'admin';
  const isEditor = userRole === 'editor';
  const isContributor = userRole === 'contributor';
  const isViewer = userRole === 'viewer';

  const checkPermission = useCallback(async (permission: Permission): Promise<boolean> => {
    if (!user || !projectId) return false;

    const cacheKey = `${projectId}-${user.id}-${permission}`;
    const cached = globalPermissionCache.get(cacheKey);

    if (cached && Date.now() < cached.expires) {
      return cached.result.has_permission;
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-permissions', {
        body: {
          project_id: projectId,
          user_id: user.id,
          required_permission: permission,
        },
      });

      if (error) {
        console.error('Error checking permission:', error);
        return false;
      }

      const result: PermissionResult = data.data;
      
      // Cache the result
      globalPermissionCache.set(cacheKey, {
        result,
        expires: Date.now() + PERMISSION_CACHE_TTL,
      });

      // Update user role if available
      if (result.user_role) {
        setUserRole(result.user_role);
      }

      return result.has_permission;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }, [user, projectId]);

  const hasPermission = useCallback((permission: Permission): boolean => {
    // Use cached permission if available
    const cached = localPermissionCache.get(permission);
    if (cached !== undefined) {
      return cached;
    }

    // Fallback to role-based permission check (optimistic)
    switch (permission) {
      case 'view':
        return canView;
      case 'edit_data':
      case 'ai_fill':
        return canEditData;
      case 'edit_structure':
      case 'manage_members':
      case 'create_snapshots':
      case 'restore_snapshots':
      case 'ai_rules':
        return canEditStructure;
      case 'transfer_ownership':
      case 'delete_project':
        return isOwner;
      default:
        return false;
    }
  }, [canView, canEditData, canEditStructure, isOwner, localPermissionCache]);

  const refreshPermissions = useCallback(async () => {
    if (!user || !projectId) return;

    setLoading(true);
    try {
      // Clear cache for this project
      const projectCacheKeys = Array.from(globalPermissionCache.keys()).filter(key => 
        key.startsWith(`${projectId}-${user.id}-`)
      );
      projectCacheKeys.forEach(key => globalPermissionCache.delete(key));

      // Check basic view permission to get user role
      const hasView = await checkPermission('view');
      if (!hasView) {
        setUserRole(null);
        return;
      }

      // Pre-cache common permissions
      const commonPermissions: Permission[] = [
        'edit_data',
        'edit_structure',
        'manage_members',
        'create_snapshots',
        'ai_fill',
        'ai_rules',
      ];

      const permissionResults = await Promise.allSettled(
        commonPermissions.map(async (permission) => ({
          permission,
          result: await checkPermission(permission),
        }))
      );

      // Update permission cache
      const newCache = new Map<Permission, boolean>();
      permissionResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          newCache.set(result.value.permission, result.value.result);
        }
      });
      setLocalPermissionCache(newCache);
    } catch (error) {
      console.error('Error refreshing permissions:', error);
    } finally {
      setLoading(false);
    }
  }, [user, projectId, checkPermission]);

  // Initial permission check
  useEffect(() => {
    refreshPermissions();
  }, [refreshPermissions]);

  return {
    userRole,
    checkPermission,
    hasPermission,
    canView,
    canEditData,
    canEditStructure,
    canManageMembers,
    canCreateSnapshots,
    canUseAI,
    canCreateAIRules,
    isOwner,
    isAdmin,
    isEditor,
    isContributor,
    isViewer,
    loading,
    refreshPermissions,
  };
}

// Helper function to get permission description for UI
export function getPermissionDescription(permission: Permission): string {
  switch (permission) {
    case 'view':
      return 'View project content';
    case 'edit_data':
      return 'Add, edit, and delete rows';
    case 'edit_structure':
      return 'Modify columns, tables, and project structure';
    case 'manage_members':
      return 'Invite, remove, and change member roles';
    case 'transfer_ownership':
      return 'Transfer project ownership to another member';
    case 'delete_project':
      return 'Permanently delete the project';
    case 'create_snapshots':
      return 'Create and manage project snapshots';
    case 'restore_snapshots':
      return 'Restore project from snapshots';
    case 'ai_fill':
      return 'Use AI features to fill and clean data';
    case 'ai_rules':
      return 'Create and manage AI-powered column rules';
    default:
      return 'Unknown permission';
  }
}

// Helper function to get minimum role required for permission
export function getMinimumRole(permission: Permission): UserRole {
  switch (permission) {
    case 'view':
      return 'viewer';
    case 'edit_data':
    case 'ai_fill':
      return 'contributor';
    case 'edit_structure':
    case 'manage_members':
    case 'create_snapshots':
    case 'restore_snapshots':
    case 'ai_rules':
      return 'admin';
    case 'transfer_ownership':
    case 'delete_project':
      return 'owner';
    default:
      return 'owner';
  }
}