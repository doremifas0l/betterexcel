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
        const { action, project_id, email, role, member_id, new_role } = await req.json();

        if (!action || !project_id) {
            throw new Error('action and project_id are required');
        }

        // Get Supabase configuration
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('Supabase configuration missing');
        }

        // Get user from auth header
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            throw new Error('No authorization header');
        }

        const token = authHeader.replace('Bearer ', '');

        // Verify token and get current user
        const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': serviceRoleKey
            }
        });

        if (!userResponse.ok) {
            throw new Error('Invalid authorization token');
        }

        const userData = await userResponse.json();
        const currentUserId = userData.id;

        // Check if current user has permission to manage members
        const permissionCheck = await fetch(`${supabaseUrl}/functions/v1/check-permissions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                project_id,
                user_id: currentUserId,
                required_permission: 'manage_members'
            })
        });

        const permissionResult = await permissionCheck.json();
        if (!permissionResult.data?.has_permission) {
            throw new Error('Insufficient permissions to manage members');
        }

        let result = {};

        switch (action) {
            case 'invite': {
                if (!email || !role) {
                    throw new Error('email and role are required for invite action');
                }

                // Check if user exists in auth
                const userSearchResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                let invitedUserId = null;
                if (userSearchResponse.ok) {
                    const users = await userSearchResponse.json();
                    const existingUser = users.users?.find(user => user.email === email);
                    if (existingUser) {
                        invitedUserId = existingUser.id;
                    }
                }

                if (!invitedUserId) {
                    // For now, we'll require users to sign up first
                    throw new Error('User with this email is not registered. Please ask them to sign up first.');
                }

                // Check if user is already a member
                const existingMemberResponse = await fetch(`${supabaseUrl}/rest/v1/project_members?user_id=eq.${invitedUserId}&project_id=eq.${project_id}`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                if (existingMemberResponse.ok) {
                    const existingMembers = await existingMemberResponse.json();
                    if (existingMembers && existingMembers.length > 0) {
                        throw new Error('User is already a member of this project');
                    }
                }

                // Add member to project
                const addMemberResponse = await fetch(`${supabaseUrl}/rest/v1/project_members`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        user_id: invitedUserId,
                        project_id,
                        role,
                        invited_by: currentUserId,
                        joined_at: new Date().toISOString()
                    })
                });

                if (!addMemberResponse.ok) {
                    const error = await addMemberResponse.text();
                    throw new Error(`Failed to add member: ${error}`);
                }

                const newMember = await addMemberResponse.json();

                // Log the action
                await fetch(`${supabaseUrl}/rest/v1/audit_logs`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        project_id,
                        user_id: currentUserId,
                        action_type: 'member_invited',
                        target_type: 'user',
                        target_id: invitedUserId,
                        details: {
                            email,
                            role,
                            invited_user_id: invitedUserId
                        }
                    })
                });

                result = { member: newMember[0], message: 'Member invited successfully' };
                break;
            }

            case 'remove': {
                if (!member_id) {
                    throw new Error('member_id is required for remove action');
                }

                // Get member details before removing
                const memberResponse = await fetch(`${supabaseUrl}/rest/v1/project_members?id=eq.${member_id}&project_id=eq.${project_id}`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                if (!memberResponse.ok) {
                    throw new Error('Member not found');
                }

                const members = await memberResponse.json();
                if (!members || members.length === 0) {
                    throw new Error('Member not found');
                }

                const member = members[0];

                // Prevent removing the last owner
                if (member.role === 'owner') {
                    const ownerCountResponse = await fetch(`${supabaseUrl}/rest/v1/project_members?project_id=eq.${project_id}&role=eq.owner&select=id`, {
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey
                        }
                    });

                    if (ownerCountResponse.ok) {
                        const owners = await ownerCountResponse.json();
                        if (owners && owners.length <= 1) {
                            throw new Error('Cannot remove the last owner. Transfer ownership first.');
                        }
                    }
                }

                // Remove member
                const removeResponse = await fetch(`${supabaseUrl}/rest/v1/project_members?id=eq.${member_id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                if (!removeResponse.ok) {
                    throw new Error('Failed to remove member');
                }

                // Log the action
                await fetch(`${supabaseUrl}/rest/v1/audit_logs`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        project_id,
                        user_id: currentUserId,
                        action_type: 'member_removed',
                        target_type: 'user',
                        target_id: member.user_id,
                        details: {
                            removed_member_id: member_id,
                            removed_user_id: member.user_id,
                            former_role: member.role
                        }
                    })
                });

                result = { message: 'Member removed successfully' };
                break;
            }

            case 'change_role': {
                if (!member_id || !new_role) {
                    throw new Error('member_id and new_role are required for change_role action');
                }

                // Update member role
                const updateResponse = await fetch(`${supabaseUrl}/rest/v1/project_members?id=eq.${member_id}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        role: new_role,
                        updated_at: new Date().toISOString()
                    })
                });

                if (!updateResponse.ok) {
                    const error = await updateResponse.text();
                    throw new Error(`Failed to update member role: ${error}`);
                }

                const updatedMember = await updateResponse.json();

                // Log the action
                await fetch(`${supabaseUrl}/rest/v1/audit_logs`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        project_id,
                        user_id: currentUserId,
                        action_type: 'member_role_changed',
                        target_type: 'user',
                        target_id: updatedMember[0].user_id,
                        details: {
                            member_id,
                            new_role,
                            changed_by: currentUserId
                        }
                    })
                });

                result = { member: updatedMember[0], message: 'Member role updated successfully' };
                break;
            }

            case 'list': {
                // Get all members for the project
                const membersResponse = await fetch(`${supabaseUrl}/rest/v1/project_members?project_id=eq.${project_id}&select=*`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                if (!membersResponse.ok) {
                    throw new Error('Failed to fetch members');
                }

                const members = await membersResponse.json();

                // Get user details for each member
                const enrichedMembers = [];
                for (const member of members || []) {
                    try {
                        const userDetailsResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${member.user_id}`, {
                            headers: {
                                'Authorization': `Bearer ${serviceRoleKey}`,
                                'apikey': serviceRoleKey
                            }
                        });

                        if (userDetailsResponse.ok) {
                            const userDetails = await userDetailsResponse.json();
                            enrichedMembers.push({
                                ...member,
                                email: userDetails.email,
                                user_metadata: userDetails.user_metadata || {}
                            });
                        } else {
                            enrichedMembers.push(member);
                        }
                    } catch (error) {
                        console.error('Error fetching user details:', error);
                        enrichedMembers.push(member);
                    }
                }

                result = { members: enrichedMembers };
                break;
            }

            default:
                throw new Error(`Unknown action: ${action}`);
        }

        return new Response(JSON.stringify({ data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Member management error:', error);

        const errorResponse = {
            error: {
                code: 'MEMBER_MANAGEMENT_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});