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
        const { action, project_id, column_id, natural_description, data, selection, source_table, operation_type } = await req.json();

        if (!action || !project_id) {
            throw new Error('action and project_id are required');
        }

        // Get Supabase and Gemini configuration
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

        if (!serviceRoleKey || !supabaseUrl || !geminiApiKey) {
            throw new Error('Required configuration missing');
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
            case 'create_rule': {
                if (!column_id || !natural_description) {
                    throw new Error('column_id and natural_description are required for create_rule action');
                }

                // Check permissions for AI rule creation (admin and above)
                const permissionCheck = await fetch(`${supabaseUrl}/functions/v1/check-permissions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        project_id,
                        user_id: currentUserId,
                        required_permission: 'ai_rules'
                    })
                });

                const permissionResult = await permissionCheck.json();
                if (!permissionResult.data?.has_permission) {
                    throw new Error('Insufficient permissions to create AI rules');
                }

                // Get column information
                const columnResponse = await fetch(`${supabaseUrl}/rest/v1/columns?id=eq.${column_id}&select=*`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                if (!columnResponse.ok) {
                    throw new Error('Column not found');
                }

                const columns = await columnResponse.json();
                if (!columns || columns.length === 0) {
                    throw new Error('Column not found');
                }

                const column = columns[0];

                // Use Gemini to convert natural language to rule
                const geminiPrompt = `Convert this natural language rule into a structured rule definition for a ${column.data_type || column.type} column named "${column.name}":

"${natural_description}"

Return a JSON object with the following structure:
{
  "rule_type": "computed" | "validation" | "formatting",
  "formula": "javascript expression or formula",
  "conditions": [{
    "condition": "condition expression",
    "value": "result value"
  }],
  "summary": "human-readable summary of what this rule does"
}

Examples:
- "Grade Bucket: A if Percent >= 85; B if >= 70; else C" -> computed rule with conditions
- "Must be between 0 and 100" -> validation rule with range check
- "Title case all text" -> formatting rule

Focus on the rule type and provide a clear formula or conditions array.`;

                const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: geminiPrompt
                            }]
                        }],
                        generationConfig: {
                            temperature: 0.1,
                            maxOutputTokens: 1000
                        }
                    })
                });

                if (!geminiResponse.ok) {
                    const errorText = await geminiResponse.text();
                    throw new Error(`Gemini API error: ${errorText}`);
                }

                const geminiData = await geminiResponse.json();
                const generatedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

                if (!generatedText) {
                    throw new Error('No response from Gemini AI');
                }

                // Parse the generated rule
                let ruleDefinition;
                try {
                    // Extract JSON from the response
                    const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        ruleDefinition = JSON.parse(jsonMatch[0]);
                    } else {
                        throw new Error('Invalid JSON response from AI');
                    }
                } catch (parseError) {
                    console.error('Failed to parse AI response:', generatedText);
                    throw new Error('Failed to parse AI-generated rule');
                }

                // Create the AI rule in database
                const createRuleResponse = await fetch(`${supabaseUrl}/rest/v1/ai_rules`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        column_id,
                        rule_type: ruleDefinition.rule_type || 'computed',
                        rule_definition: ruleDefinition,
                        natural_language_description: natural_description,
                        created_by: currentUserId,
                        is_active: false // Start inactive until user approves
                    })
                });

                if (!createRuleResponse.ok) {
                    const error = await createRuleResponse.text();
                    throw new Error(`Failed to create rule: ${error}`);
                }

                const newRule = await createRuleResponse.json();

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
                        action_type: 'ai_rule_created',
                        target_type: 'ai_rule',
                        target_id: newRule[0].id,
                        details: {
                            column_id,
                            rule_type: ruleDefinition.rule_type,
                            natural_description
                        }
                    })
                });

                result = { 
                    rule: newRule[0], 
                    ai_generated: ruleDefinition,
                    message: 'AI rule created successfully. Review and activate when ready.' 
                };
                break;
            }

            case 'cleanup_data': {
                if (!data || !operation_type) {
                    throw new Error('data and operation_type are required for cleanup_data action');
                }

                // Check permissions for data editing (contributor and above)
                const permissionCheck = await fetch(`${supabaseUrl}/functions/v1/check-permissions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        project_id,
                        user_id: currentUserId,
                        required_permission: 'edit_data'
                    })
                });

                const permissionResult = await permissionCheck.json();
                if (!permissionResult.data?.has_permission) {
                    throw new Error('Insufficient permissions to edit data');
                }

                const geminiPrompt = `Clean and normalize the following data using the "${operation_type}" operation:

Data: ${JSON.stringify(data, null, 2)}

Operation: ${operation_type}

Provide the cleaned data as a JSON array where each object has:
{
  "original": "original value",
  "cleaned": "cleaned value",
  "confidence": 0.95, // confidence score 0-1
  "explanation": "brief explanation of changes made"
}

Common operations:
- "title_case": Convert to proper title case
- "normalize_codes": Standardize format of codes/IDs
- "split_names": Split full names into first/last
- "clean_emails": Standardize email format
- "format_phones": Standardize phone number format

Only suggest changes that improve data quality and consistency.`;

                const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: geminiPrompt
                            }]
                        }],
                        generationConfig: {
                            temperature: 0.1,
                            maxOutputTokens: 2000
                        }
                    })
                });

                if (!geminiResponse.ok) {
                    const errorText = await geminiResponse.text();
                    throw new Error(`Gemini API error: ${errorText}`);
                }

                const geminiData = await geminiResponse.json();
                const generatedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

                if (!generatedText) {
                    throw new Error('No response from Gemini AI');
                }

                // Parse the generated suggestions
                let cleanupSuggestions;
                try {
                    const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
                    if (jsonMatch) {
                        cleanupSuggestions = JSON.parse(jsonMatch[0]);
                    } else {
                        throw new Error('Invalid JSON response from AI');
                    }
                } catch (parseError) {
                    console.error('Failed to parse AI response:', generatedText);
                    throw new Error('Failed to parse AI cleanup suggestions');
                }

                result = { 
                    suggestions: cleanupSuggestions,
                    operation_type,
                    message: 'Data cleanup suggestions generated. Review before applying.' 
                };
                break;
            }

            case 'fill_data': {
                if (!data || !source_table) {
                    throw new Error('data and source_table are required for fill_data action');
                }

                // Check permissions for data editing (contributor and above)
                const permissionCheck = await fetch(`${supabaseUrl}/functions/v1/check-permissions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        project_id,
                        user_id: currentUserId,
                        required_permission: 'ai_fill'
                    })
                });

                const permissionResult = await permissionCheck.json();
                if (!permissionResult.data?.has_permission) {
                    throw new Error('Insufficient permissions to use AI fill');
                }

                // Get source table data for reference
                const sourceDataResponse = await fetch(`${supabaseUrl}/rest/v1/rows?sheet_id=in.(${source_table})&select=*&limit=100`, {
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey
                    }
                });

                let sourceData = [];
                if (sourceDataResponse.ok) {
                    sourceData = await sourceDataResponse.json();
                }

                const geminiPrompt = `Fill missing data using the source table as reference:

Data to fill: ${JSON.stringify(data, null, 2)}

Source table data (for reference): ${JSON.stringify(sourceData.slice(0, 20), null, 2)}

Fill missing values by finding matches in the source data or making intelligent suggestions based on patterns. Return a JSON array with:
{
  "row_id": "row identifier",
  "field": "field name",
  "original": null,
  "suggested": "suggested value",
  "confidence": 0.95,
  "source": "explanation of how value was derived"
}

Only suggest values that:
1. Have high confidence (>0.7)
2. Follow existing patterns in the data
3. Are consistent with data types and validation rules
4. Use only values that exist in the source table for select/reference fields`;

                const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: geminiPrompt
                            }]
                        }],
                        generationConfig: {
                            temperature: 0.2,
                            maxOutputTokens: 2000
                        }
                    })
                });

                if (!geminiResponse.ok) {
                    const errorText = await geminiResponse.text();
                    throw new Error(`Gemini API error: ${errorText}`);
                }

                const geminiData = await geminiResponse.json();
                const generatedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

                if (!generatedText) {
                    throw new Error('No response from Gemini AI');
                }

                // Parse the generated suggestions
                let fillSuggestions;
                try {
                    const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
                    if (jsonMatch) {
                        fillSuggestions = JSON.parse(jsonMatch[0]);
                    } else {
                        throw new Error('Invalid JSON response from AI');
                    }
                } catch (parseError) {
                    console.error('Failed to parse AI response:', generatedText);
                    throw new Error('Failed to parse AI fill suggestions');
                }

                result = { 
                    suggestions: fillSuggestions,
                    source_table,
                    message: 'Data fill suggestions generated. Review before applying.' 
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
        console.error('AI processing error:', error);

        const errorResponse = {
            error: {
                code: 'AI_PROCESSING_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});