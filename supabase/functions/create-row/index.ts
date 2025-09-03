import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { sheet_id, row_data } = await req.json()

    if (!sheet_id || !row_data) {
      throw new Error('sheet_id and row_data are required')
    }

    // Create a Supabase client with the user's authentication
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get the authenticated user's ID
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    // Prepare the data for insertion
    const insertData = {
      sheet_id: sheet_id,
      row_data: row_data,
      user_id: user.id // Use the authenticated user's ID
    }

    // Insert the new row into the 'rows' table
    const { data, error } = await supabaseClient
      .from('rows')
      .insert(insertData)
      .select()
      .single() // Use .single() if you expect one row back

    if (error) {
      console.error('Supabase insert error:', error)
      throw error // Let the catch block handle it
    }

    console.log('Row created successfully:', data.id)

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error in create-row function:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})