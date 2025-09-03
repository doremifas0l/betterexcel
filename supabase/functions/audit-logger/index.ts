Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Credentials': 'false'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        const { action, project_id, action_type, target_type, target_id, details, user_id, limit, offset } = await req.json();

        if (!action || !project_id) {
            throw new Error('action and project_id are required');
        }

        // Get Supabase configuration
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('Supabase configuration missing');
        }

        // Get user from auth header if not provided
        let currentUserId = user_id;
        if (!currentUserId) {
            const authHeader = req.headers.get('authorization');
            if (authHeader) {
                const token = authHeader.replace('Bearer ', '');

                const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'apikey': serviceRoleKey
                    }
                });

                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    currentUserId = userData.id;
                }
            }
        }

        let result = {};

        switch (action) {
            case 'log': {
                if (!action_type || !target_type) {
                    throw new Error('action_type and target_type are required for log action');
                }

                // Create audit log entry
                const logResponse = await fetch(`${supabaseUrl}/rest/v1/audit_logs`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        project_id,
                        user_id: currentUserId,
                        action_type,
                        target_type,
                        target_id: target_id || null,
                        details: details || {},
                        timestamp: new Date().toISOString()
                    })
                });

                if (!logResponse.ok) {
                    const error = await logResponse.text();
                    throw new Error(`Failed to create audit log: ${error}`);
                }

                const logEntry = await logResponse.json();
                result = { log: logEntry[0], message: 'Audit log created successfully' };
                break;
            }

            case 'get_timeline': {
                // Check if user has permission to view project
                const permissionCheck = await fetch(`${supabaseUrl}/functions/v1/check-permissions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        project_id,
                        user_id: currentUserId,
                        required_permission: 'view'
                    })
                });

                const permissionResult = await permissionCheck.json();
                if (!permissionResult.data?.has_permission) {
                    throw new Error('Insufficient permissions to view audit logs');
                }

                // Build query parameters
                let query = `project_id=eq.${project_id}&order=timestamp.desc`;
                
                if (limit) {
                    query += `&limit=${limit}`;
                }
                
                if (offset) {
                    query += `&offset=${offset}`;
                }

                if (target_type) {
                    query += `&target_type=eq.${target_type}`;
                }

                if (target_id) {
                    query += `&target_id=eq.${target_id}`;
                }

                if (user_id) {
                    query += `&user_id=eq.${user_id}`;
                }

                // Get audit logs
                const logsResponse = await fetch(`${supabaseUrl}/rest/v1/audit_logs?${query}&select=*`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                if (!logsResponse.ok) {
                    throw new Error('Failed to fetch audit logs');
                }

                const logs = await logsResponse.json();

                // Enrich logs with user information
                const enrichedLogs = [];
                const userCache = new Map();

                for (const log of logs || []) {
                    let userEmail = null;
                    
                    if (log.user_id && !userCache.has(log.user_id)) {
                        try {
                            const userResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${log.user_id}`, {
                                headers: {
                                    'Authorization': `Bearer ${serviceRoleKey}`,
                                    'apikey': serviceRoleKey
                                }
                            });

                            if (userResponse.ok) {
                                const userData = await userResponse.json();
                                userCache.set(log.user_id, userData.email);
                                userEmail = userData.email;
                            }
                        } catch (error) {
                            console.error('Error fetching user for audit log:', error);
                        }
                    } else if (log.user_id) {
                        userEmail = userCache.get(log.user_id);
                    }

                    enrichedLogs.push({
                        ...log,
                        user_email: userEmail,
                        formatted_timestamp: new Date(log.timestamp).toLocaleString(),
                        action_summary: formatActionSummary(log.action_type, log.target_type, log.details)
                    });
                }

                result = { 
                    logs: enrichedLogs, 
                    total: enrichedLogs.length,
                    has_more: enrichedLogs.length === (limit || 50)
                };
                break;
            }

            case 'get_stats': {
                // Check if user has permission to view project
                const permissionCheck = await fetch(`${supabaseUrl}/functions/v1/check-permissions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        project_id,
                        user_id: currentUserId,
                        required_permission: 'view'
                    })
                });

                const permissionResult = await permissionCheck.json();
                if (!permissionResult.data?.has_permission) {
                    throw new Error('Insufficient permissions to view audit stats');
                }

                // Get various statistics
                const now = new Date();
                const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

                // Total actions
                const totalResponse = await fetch(`${supabaseUrl}/rest/v1/audit_logs?project_id=eq.${project_id}&select=id`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                const totalLogs = totalResponse.ok ? await totalResponse.json() : [];

                // Actions in last 24 hours
                const recentResponse = await fetch(`${supabaseUrl}/rest/v1/audit_logs?project_id=eq.${project_id}&timestamp=gte.${dayAgo.toISOString()}&select=action_type`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                const recentLogs = recentResponse.ok ? await recentResponse.json() : [];

                // Most active users
                const userActivityResponse = await fetch(`${supabaseUrl}/rest/v1/audit_logs?project_id=eq.${project_id}&timestamp=gte.${weekAgo.toISOString()}&select=user_id`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                const userActivityLogs = userActivityResponse.ok ? await userActivityResponse.json() : [];
                const userActivityMap = {};
                userActivityLogs.forEach(log => {
                    if (log.user_id) {
                        userActivityMap[log.user_id] = (userActivityMap[log.user_id] || 0) + 1;
                    }
                });

                // Action type distribution
                const actionTypeMap = {};
                recentLogs.forEach(log => {
                    actionTypeMap[log.action_type] = (actionTypeMap[log.action_type] || 0) + 1;
                });

                result = {
                    total_actions: totalLogs.length,
                    recent_actions: recentLogs.length,
                    action_types: actionTypeMap,
                    active_users: Object.keys(userActivityMap).length,
                    most_active_user: Object.entries(userActivityMap).sort((a, b) => b[1] - a[1])[0]?.[0]
                };
                break;
            }

            default:
                throw new Error(`Unknown action: ${action}`);
        }

        return new Response(JSON.stringify({ data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Audit logging error:', error);

        const errorResponse = {
            error: {
                code: 'AUDIT_LOGGING_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// Helper function to format action summaries
function formatActionSummary(actionType: string, targetType: string, details: any): string {
    switch (actionType) {
        case 'row_created':
            return `Created new ${targetType}`;
        case 'row_updated':
            return `Updated ${targetType} data`;
        case 'row_deleted':
            return `Deleted ${targetType}`;
        case 'column_created':
            return `Added new column: ${details?.column_name || 'Unknown'}`;
        case 'column_updated':
            return `Modified column: ${details?.column_name || 'Unknown'}`;
        case 'column_deleted':
            return `Removed column: ${details?.column_name || 'Unknown'}`;
        case 'member_invited':
            return `Invited ${details?.email} as ${details?.role}`;
        case 'member_removed':
            return `Removed member with ${details?.former_role} role`;
        case 'member_role_changed':
            return `Changed member role to ${details?.new_role}`;
        case 'snapshot_created':
            return `Created snapshot: ${details?.snapshot_name || 'Unnamed'}`;
        case 'snapshot_restored':
            return `Restored from snapshot: ${details?.snapshot_name || 'Unknown'}`;
        case 'ai_rule_created':
            return `Created AI rule for ${details?.column_name || 'column'}`;
        case 'ai_rule_activated':
            return `Activated AI rule: ${details?.rule_type}`;
        case 'ai_cleanup_applied':
            return `Applied AI cleanup: ${details?.operation_type}`;
        case 'ai_fill_applied':
            return `Applied AI fill for ${details?.field_count || 0} fields`;
        case 'bulk_paste':
            return `Pasted ${details?.row_count || 0} rows`;
        case 'bulk_import':
            return `Imported ${details?.row_count || 0} rows from ${details?.source || 'file'}`;
        case 'project_settings_updated':
            return `Updated project settings`;
        case 'table_created':
            return `Created table: ${details?.table_name || 'Unknown'}`;
        case 'table_deleted':
            return `Deleted table: ${details?.table_name || 'Unknown'}`;
        default:
            return `${actionType.replace(/_/g, ' ')} on ${targetType}`;
    }
}