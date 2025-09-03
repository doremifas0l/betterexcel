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
        const { project_id, user_id, required_permission } = await req.json();

        if (!project_id || !user_id || !required_permission) {
            throw new Error('project_id, user_id, and required_permission are required');
        }

        // Get Supabase configuration
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('Supabase configuration missing');
        }

        // Get user's role in the project
        const memberResponse = await fetch(`${supabaseUrl}/rest/v1/project_members?user_id=eq.${user_id}&project_id=eq.${project_id}&select=role`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        if (!memberResponse.ok) {
            throw new Error('Failed to fetch user role');
        }

        const memberData = await memberResponse.json();
        
        if (!memberData || memberData.length === 0) {
            // Check if user is the project owner (fallback for existing projects)
            const projectResponse = await fetch(`${supabaseUrl}/rest/v1/projects?id=eq.${project_id}&user_id=eq.${user_id}&select=id`, {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                }
            });

            if (projectResponse.ok) {
                const projectData = await projectResponse.json();
                if (projectData && projectData.length > 0) {
                    // User is project owner, grant owner permissions
                    return new Response(JSON.stringify({
                        data: {
                            has_permission: true,
                            user_role: 'owner',
                            reason: 'Project owner'
                        }
                    }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
            }

            return new Response(JSON.stringify({
                data: {
                    has_permission: false,
                    user_role: null,
                    reason: 'User not a member of this project'
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const userRole = memberData[0].role;

        // Define role hierarchy and permissions
        const roleHierarchy = {
            owner: 5,
            admin: 4,
            editor: 3,
            contributor: 2,
            viewer: 1
        };

        const permissionRequirements = {
            view: 1, // viewer and above
            edit_data: 2, // contributor and above
            edit_structure: 4, // admin and above
            manage_members: 4, // admin and above
            transfer_ownership: 5, // owner only
            delete_project: 5, // owner only
            create_snapshots: 4, // admin and above
            restore_snapshots: 4, // admin and above
            ai_fill: 2, // contributor and above
            ai_rules: 4 // admin and above
        };

        const userRoleLevel = roleHierarchy[userRole] || 0;
        const requiredLevel = permissionRequirements[required_permission] || 999;

        const hasPermission = userRoleLevel >= requiredLevel;

        return new Response(JSON.stringify({
            data: {
                has_permission: hasPermission,
                user_role: userRole,
                required_level: requiredLevel,
                user_level: userRoleLevel,
                reason: hasPermission ? 'Permission granted' : `Requires ${required_permission} permission (level ${requiredLevel}), user has ${userRole} (level ${userRoleLevel})`
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Permission check error:', error);

        const errorResponse = {
            error: {
                code: 'PERMISSION_CHECK_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});