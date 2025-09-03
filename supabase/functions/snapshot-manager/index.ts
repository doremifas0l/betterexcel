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
        const { action, project_id, snapshot_id, snapshot_name, note, limit } = await req.json();

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

        let result = {};

        switch (action) {
            case 'create': {
                if (!snapshot_name) {
                    throw new Error('snapshot_name is required for create action');
                }

                // Check permissions for snapshot creation (admin and above)
                const permissionCheck = await fetch(`${supabaseUrl}/functions/v1/check-permissions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        project_id,
                        user_id: currentUserId,
                        required_permission: 'create_snapshots'
                    })
                });

                const permissionResult = await permissionCheck.json();
                if (!permissionResult.data?.has_permission) {
                    throw new Error('Insufficient permissions to create snapshots');
                }

                // Collect all project data
                console.log('Collecting project data for snapshot...');

                // Get project info
                const projectResponse = await fetch(`${supabaseUrl}/rest/v1/projects?id=eq.${project_id}&select=*`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                if (!projectResponse.ok) {
                    throw new Error('Project not found');
                }

                const projects = await projectResponse.json();
                if (!projects || projects.length === 0) {
                    throw new Error('Project not found');
                }

                const project = projects[0];

                // Get all tables
                const tablesResponse = await fetch(`${supabaseUrl}/rest/v1/better_tables?project_id=eq.${project_id}&is_deleted=eq.false&select=*`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                const tables = tablesResponse.ok ? await tablesResponse.json() : [];
                console.log(`Found ${tables.length} tables`);

                const snapshotData = {
                    project: project,
                    tables: [],
                    created_at: new Date().toISOString()
                };

                // For each table, get sheets, columns, and rows
                for (const table of tables) {
                    console.log(`Processing table: ${table.name}`);
                    
                    // Get sheets for this table
                    const sheetsResponse = await fetch(`${supabaseUrl}/rest/v1/better_sheets?table_id=eq.${table.id}&is_deleted=eq.false&select=*`, {
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey
                        }
                    });

                    const sheets = sheetsResponse.ok ? await sheetsResponse.json() : [];

                    const tableData = {
                        table: table,
                        sheets: []
                    };

                    for (const sheet of sheets) {
                        console.log(`Processing sheet: ${sheet.name}`);
                        
                        // Get columns for this sheet
                        const columnsResponse = await fetch(`${supabaseUrl}/rest/v1/columns?sheet_id=eq.${sheet.id}&is_deleted=eq.false&select=*&order=position.asc`, {
                            headers: {
                                'Authorization': `Bearer ${serviceRoleKey}`,
                                'apikey': serviceRoleKey
                            }
                        });

                        const columns = columnsResponse.ok ? await columnsResponse.json() : [];

                        // Get rows for this sheet
                        const rowsResponse = await fetch(`${supabaseUrl}/rest/v1/rows?sheet_id=eq.${sheet.id}&is_deleted=eq.false&select=*&order=row_order.asc`, {
                            headers: {
                                'Authorization': `Bearer ${serviceRoleKey}`,
                                'apikey': serviceRoleKey
                            }
                        });

                        const rows = rowsResponse.ok ? await rowsResponse.json() : [];

                        // Get additional configurations for columns
                        const columnConfigs = {};
                        for (const column of columns) {
                            // Get link configurations
                            const linkConfigResponse = await fetch(`${supabaseUrl}/rest/v1/link_configurations?column_id=eq.${column.id}&select=*`, {
                                headers: {
                                    'Authorization': `Bearer ${serviceRoleKey}`,
                                    'apikey': serviceRoleKey
                                }
                            });

                            const linkConfigs = linkConfigResponse.ok ? await linkConfigResponse.json() : [];

                            // Get rollup configurations
                            const rollupConfigResponse = await fetch(`${supabaseUrl}/rest/v1/rollup_configurations?column_id=eq.${column.id}&select=*`, {
                                headers: {
                                    'Authorization': `Bearer ${serviceRoleKey}`,
                                    'apikey': serviceRoleKey
                                }
                            });

                            const rollupConfigs = rollupConfigResponse.ok ? await rollupConfigResponse.json() : [];

                            // Get select options
                            const selectOptionsResponse = await fetch(`${supabaseUrl}/rest/v1/select_options?column_id=eq.${column.id}&is_active=eq.true&select=*&order=option_order.asc`, {
                                headers: {
                                    'Authorization': `Bearer ${serviceRoleKey}`,
                                    'apikey': serviceRoleKey
                                }
                            });

                            const selectOptions = selectOptionsResponse.ok ? await selectOptionsResponse.json() : [];

                            // Get AI rules
                            const aiRulesResponse = await fetch(`${supabaseUrl}/rest/v1/ai_rules?column_id=eq.${column.id}&select=*`, {
                                headers: {
                                    'Authorization': `Bearer ${serviceRoleKey}`,
                                    'apikey': serviceRoleKey
                                }
                            });

                            const aiRules = aiRulesResponse.ok ? await aiRulesResponse.json() : [];

                            columnConfigs[column.id] = {
                                link_configurations: linkConfigs,
                                rollup_configurations: rollupConfigs,
                                select_options: selectOptions,
                                ai_rules: aiRules
                            };
                        }

                        tableData.sheets.push({
                            sheet: sheet,
                            columns: columns,
                            rows: rows,
                            column_configs: columnConfigs
                        });
                    }

                    snapshotData.tables.push(tableData);
                }

                // Get project members
                const membersResponse = await fetch(`${supabaseUrl}/rest/v1/project_members?project_id=eq.${project_id}&select=*`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                snapshotData.members = membersResponse.ok ? await membersResponse.json() : [];

                console.log('Creating snapshot record...');

                // Create the snapshot record
                const createSnapshotResponse = await fetch(`${supabaseUrl}/rest/v1/project_snapshots`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        project_id,
                        created_by: currentUserId,
                        snapshot_name,
                        note: note || null,
                        snapshot_data: snapshotData,
                        created_at: new Date().toISOString()
                    })
                });

                if (!createSnapshotResponse.ok) {
                    const error = await createSnapshotResponse.text();
                    throw new Error(`Failed to create snapshot: ${error}`);
                }

                const newSnapshot = await createSnapshotResponse.json();

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
                        action_type: 'snapshot_created',
                        target_type: 'snapshot',
                        target_id: newSnapshot[0].id,
                        details: {
                            snapshot_name,
                            note,
                            tables_count: snapshotData.tables.length,
                            total_rows: snapshotData.tables.reduce((sum, table) => 
                                sum + table.sheets.reduce((sheetSum, sheet) => sheetSum + sheet.rows.length, 0), 0
                            )
                        }
                    })
                });

                console.log('Snapshot created successfully');
                result = { 
                    snapshot: newSnapshot[0], 
                    message: 'Snapshot created successfully',
                    stats: {
                        tables: snapshotData.tables.length,
                        total_rows: snapshotData.tables.reduce((sum, table) => 
                            sum + table.sheets.reduce((sheetSum, sheet) => sheetSum + sheet.rows.length, 0), 0
                        )
                    }
                };
                break;
            }

            case 'list': {
                // Check permissions to view snapshots
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
                    throw new Error('Insufficient permissions to view snapshots');
                }

                // Get snapshots for the project
                const query = `project_id=eq.${project_id}&order=created_at.desc`;
                const limitQuery = limit ? `&limit=${limit}` : '&limit=20';

                const snapshotsResponse = await fetch(`${supabaseUrl}/rest/v1/project_snapshots?${query}${limitQuery}&select=id,snapshot_name,note,created_by,created_at`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                if (!snapshotsResponse.ok) {
                    throw new Error('Failed to fetch snapshots');
                }

                const snapshots = await snapshotsResponse.json();

                // Enrich with creator information
                const enrichedSnapshots = [];
                for (const snapshot of snapshots || []) {
                    let creatorEmail = null;
                    try {
                        const userResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${snapshot.created_by}`, {
                            headers: {
                                'Authorization': `Bearer ${serviceRoleKey}`,
                                'apikey': serviceRoleKey
                            }
                        });

                        if (userResponse.ok) {
                            const userData = await userResponse.json();
                            creatorEmail = userData.email;
                        }
                    } catch (error) {
                        console.error('Error fetching user for snapshot:', error);
                    }

                    enrichedSnapshots.push({
                        ...snapshot,
                        creator_email: creatorEmail,
                        formatted_created_at: new Date(snapshot.created_at).toLocaleString()
                    });
                }

                result = { snapshots: enrichedSnapshots };
                break;
            }

            case 'restore': {
                if (!snapshot_id) {
                    throw new Error('snapshot_id is required for restore action');
                }

                // Check permissions for snapshot restoration (admin and above)
                const permissionCheck = await fetch(`${supabaseUrl}/functions/v1/check-permissions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        project_id,
                        user_id: currentUserId,
                        required_permission: 'restore_snapshots'
                    })
                });

                const permissionResult = await permissionCheck.json();
                if (!permissionResult.data?.has_permission) {
                    throw new Error('Insufficient permissions to restore snapshots');
                }

                // Get the snapshot data
                const snapshotResponse = await fetch(`${supabaseUrl}/rest/v1/project_snapshots?id=eq.${snapshot_id}&project_id=eq.${project_id}&select=*`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                if (!snapshotResponse.ok) {
                    throw new Error('Snapshot not found');
                }

                const snapshots = await snapshotResponse.json();
                if (!snapshots || snapshots.length === 0) {
                    throw new Error('Snapshot not found');
                }

                const snapshot = snapshots[0];
                const snapshotData = snapshot.snapshot_data;

                console.log('Starting snapshot restoration...');

                // Mark current data as deleted before restoring
                // Delete current tables
                await fetch(`${supabaseUrl}/rest/v1/better_tables?project_id=eq.${project_id}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        is_deleted: true,
                        deleted_at: new Date().toISOString()
                    })
                });

                // Restore project settings
                await fetch(`${supabaseUrl}/rest/v1/projects?id=eq.${project_id}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: snapshotData.project.name,
                        description: snapshotData.project.description,
                        settings: snapshotData.project.settings,
                        updated_at: new Date().toISOString(),
                        updated_by: currentUserId
                    })
                });

                // Restore each table with its data
                const restorationStats = {
                    tables: 0,
                    sheets: 0,
                    columns: 0,
                    rows: 0
                };

                for (const tableData of snapshotData.tables || []) {
                    console.log(`Restoring table: ${tableData.table.name}`);
                    
                    // Create table
                    const tableResponse = await fetch(`${supabaseUrl}/rest/v1/better_tables`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=representation'
                        },
                        body: JSON.stringify({
                            id: tableData.table.id, // Use original ID
                            project_id,
                            name: tableData.table.name,
                            description: tableData.table.description,
                            user_id: tableData.table.user_id,
                            created_by: tableData.table.created_by || tableData.table.user_id,
                            updated_by: currentUserId,
                            created_at: tableData.table.created_at,
                            updated_at: new Date().toISOString(),
                            is_deleted: false
                        })
                    });

                    if (!tableResponse.ok) {
                        console.error('Failed to restore table:', await tableResponse.text());
                        continue;
                    }

                    restorationStats.tables++;

                    // Restore sheets for this table
                    for (const sheetData of tableData.sheets || []) {
                        console.log(`Restoring sheet: ${sheetData.sheet.name}`);
                        
                        // Create sheet
                        const sheetResponse = await fetch(`${supabaseUrl}/rest/v1/better_sheets`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${serviceRoleKey}`,
                                'apikey': serviceRoleKey,
                                'Content-Type': 'application/json',
                                'Prefer': 'return=representation'
                            },
                            body: JSON.stringify({
                                id: sheetData.sheet.id, // Use original ID
                                table_id: tableData.table.id,
                                name: sheetData.sheet.name,
                                description: sheetData.sheet.description,
                                user_id: sheetData.sheet.user_id,
                                created_by: sheetData.sheet.created_by || sheetData.sheet.user_id,
                                updated_by: currentUserId,
                                created_at: sheetData.sheet.created_at,
                                updated_at: new Date().toISOString(),
                                is_deleted: false
                            })
                        });

                        if (!sheetResponse.ok) {
                            console.error('Failed to restore sheet:', await sheetResponse.text());
                            continue;
                        }

                        restorationStats.sheets++;

                        // Restore columns
                        for (const column of sheetData.columns || []) {
                            const columnResponse = await fetch(`${supabaseUrl}/rest/v1/columns`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${serviceRoleKey}`,
                                    'apikey': serviceRoleKey,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    id: column.id, // Use original ID
                                    sheet_id: sheetData.sheet.id,
                                    name: column.name,
                                    data_type: column.data_type || column.type,
                                    type: column.type || column.data_type,
                                    is_required: column.is_required || column.required,
                                    required: column.required || column.is_required,
                                    is_unique: column.is_unique,
                                    default_value: column.default_value,
                                    position: column.position || column.column_order,
                                    column_order: column.column_order || column.position,
                                    validation_rules: column.validation_rules,
                                    config: column.config,
                                    display_settings: column.display_settings,
                                    formula: column.formula,
                                    user_id: column.user_id,
                                    created_by: column.created_by || column.user_id,
                                    updated_by: currentUserId,
                                    created_at: column.created_at,
                                    updated_at: new Date().toISOString(),
                                    is_deleted: false
                                })
                            });

                            if (columnResponse.ok) {
                                restorationStats.columns++;
                                
                                // Restore column configurations if they exist
                                const columnConfig = sheetData.column_configs?.[column.id];
                                if (columnConfig) {
                                    // Restore link configurations
                                    for (const linkConfig of columnConfig.link_configurations || []) {
                                        await fetch(`${supabaseUrl}/rest/v1/link_configurations`, {
                                            method: 'POST',
                                            headers: {
                                                'Authorization': `Bearer ${serviceRoleKey}`,
                                                'apikey': serviceRoleKey,
                                                'Content-Type': 'application/json'
                                            },
                                            body: JSON.stringify(linkConfig)
                                        });
                                    }

                                    // Restore select options
                                    for (const selectOption of columnConfig.select_options || []) {
                                        await fetch(`${supabaseUrl}/rest/v1/select_options`, {
                                            method: 'POST',
                                            headers: {
                                                'Authorization': `Bearer ${serviceRoleKey}`,
                                                'apikey': serviceRoleKey,
                                                'Content-Type': 'application/json'
                                            },
                                            body: JSON.stringify(selectOption)
                                        });
                                    }

                                    // Restore AI rules
                                    for (const aiRule of columnConfig.ai_rules || []) {
                                        await fetch(`${supabaseUrl}/rest/v1/ai_rules`, {
                                            method: 'POST',
                                            headers: {
                                                'Authorization': `Bearer ${serviceRoleKey}`,
                                                'apikey': serviceRoleKey,
                                                'Content-Type': 'application/json'
                                            },
                                            body: JSON.stringify({
                                                ...aiRule,
                                                updated_by: currentUserId,
                                                updated_at: new Date().toISOString()
                                            })
                                        });
                                    }
                                }
                            }
                        }

                        // Restore rows
                        for (const row of sheetData.rows || []) {
                            const rowResponse = await fetch(`${supabaseUrl}/rest/v1/rows`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${serviceRoleKey}`,
                                    'apikey': serviceRoleKey,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    id: row.id, // Use original ID
                                    sheet_id: sheetData.sheet.id,
                                    row_data: row.row_data,
                                    row_order: row.row_order,
                                    user_id: row.user_id,
                                    created_by: row.created_by || row.user_id,
                                    updated_by: currentUserId,
                                    created_at: row.created_at,
                                    updated_at: new Date().toISOString(),
                                    is_deleted: false
                                })
                            });

                            if (rowResponse.ok) {
                                restorationStats.rows++;
                            }
                        }
                    }
                }

                // Restore project members
                await fetch(`${supabaseUrl}/rest/v1/project_members?project_id=eq.${project_id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                for (const member of snapshotData.members || []) {
                    await fetch(`${supabaseUrl}/rest/v1/project_members`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            ...member,
                            updated_at: new Date().toISOString()
                        })
                    });
                }

                // Log the restoration
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
                        action_type: 'snapshot_restored',
                        target_type: 'snapshot',
                        target_id: snapshot_id,
                        details: {
                            snapshot_name: snapshot.snapshot_name,
                            restoration_stats: restorationStats,
                            restored_at: new Date().toISOString()
                        }
                    })
                });

                console.log('Snapshot restoration completed');
                result = { 
                    message: 'Snapshot restored successfully',
                    stats: restorationStats,
                    snapshot_name: snapshot.snapshot_name
                };
                break;
            }

            case 'delete': {
                if (!snapshot_id) {
                    throw new Error('snapshot_id is required for delete action');
                }

                // Check permissions for snapshot deletion (admin and above)
                const permissionCheck = await fetch(`${supabaseUrl}/functions/v1/check-permissions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        project_id,
                        user_id: currentUserId,
                        required_permission: 'create_snapshots'
                    })
                });

                const permissionResult = await permissionCheck.json();
                if (!permissionResult.data?.has_permission) {
                    throw new Error('Insufficient permissions to delete snapshots');
                }

                // Delete the snapshot
                const deleteResponse = await fetch(`${supabaseUrl}/rest/v1/project_snapshots?id=eq.${snapshot_id}&project_id=eq.${project_id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                if (!deleteResponse.ok) {
                    throw new Error('Failed to delete snapshot');
                }

                result = { message: 'Snapshot deleted successfully' };
                break;
            }

            default:
                throw new Error(`Unknown action: ${action}`);
        }

        return new Response(JSON.stringify({ data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Snapshot management error:', error);

        const errorResponse = {
            error: {
                code: 'SNAPSHOT_MANAGEMENT_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});