import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Inlined security utilities to avoid external dependencies
const rateLimiter = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMITS = {
  FORM_ACCESS: { limit: 50, windowMs: 60 * 1000 },
  FORM_SUBMIT: { limit: 10, windowMs: 60 * 1000 },
  PASSCODE_ATTEMPT: { limit: 5, windowMs: 60 * 60 * 1000 },
  ADMIN_ACTION: { limit: 100, windowMs: 60 * 1000 }
};

const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

function checkRateLimit(
  ip: string, 
  action: keyof typeof RATE_LIMITS
): { allowed: boolean; remainingAttempts?: number; resetTime?: number } {
  const config = RATE_LIMITS[action];
  const key = `${ip}:${action}`;
  const now = Date.now();
  const entry = rateLimiter.get(key);
  
  if (!entry || now > entry.resetTime) {
    rateLimiter.set(key, { count: 1, resetTime: now + config.windowMs });
    return { 
      allowed: true, 
      remainingAttempts: config.limit - 1, 
      resetTime: now + config.windowMs 
    };
  }
  
  if (entry.count >= config.limit) {
    return { 
      allowed: false, 
      remainingAttempts: 0, 
      resetTime: entry.resetTime 
    };
  }
  
  entry.count++;
  return { 
    allowed: true, 
    remainingAttempts: config.limit - entry.count, 
    resetTime: entry.resetTime 
  };
}

function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  const cfConnecting = req.headers.get('cf-connecting-ip');
  if (cfConnecting) {
    return cfConnecting;
  }
  
  return 'unknown';
}

function logSecurityEvent(
  event: string, 
  ip: string, 
  details: Record<string, any>
): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    ip,
    ...details
  }));
}

function getSecureCorsHeaders(origin?: string): Record<string, string> {
  // Temporary: Allow all origins to resolve CORS issue
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
    'Access-Control-Max-Age': '86400',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'",
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };
}

function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
  
  if (Array.isArray(input)) {
    return input.map(item => sanitizeInput(item));
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[sanitizeInput(key)] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
}

Deno.serve(async (req) => {
  const clientIP = getClientIP(req);
  const origin = req.headers.get('origin');
  const corsHeaders = getSecureCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limit admin actions
    const rateCheck = checkRateLimit(clientIP, 'ADMIN_ACTION');
    if (!rateCheck.allowed) {
      logSecurityEvent('FORM_MANAGE_RATE_LIMIT_EXCEEDED', clientIP, { resetTime: rateCheck.resetTime });
      return new Response(JSON.stringify({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many admin requests. Please try again later.',
          resetTime: rateCheck.resetTime
        }
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Authenticate user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid authentication token');
    }

    const requestBody = await req.json();
    const { action, ...params } = sanitizeInput(requestBody);
    
    // Add user_id to params for authorization checks
    params.user_id = user.id;

    logSecurityEvent('FORM_MANAGE_ACTION', clientIP, { action, user_id: user.id, form_id: params.form_id });

    switch (action) {
      case 'list_submissions':
        return await listSubmissions(supabase, params);
      
      case 'get_submission_details':
        return await getSubmissionDetails(supabase, params);
      
      case 'get_cross_table_data':
        return await getCrossTableData(supabase, params);
      
      case 'delete_submission':
        return await deleteSubmission(supabase, params);
      
      case 'export_submissions':
        return await exportSubmissions(supabase, params);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error: any) {
    console.error('Error in forms-manage function:', error);
    
    logSecurityEvent('FORM_MANAGE_ERROR', clientIP, { 
      error: error.message 
    });
    
    return new Response(JSON.stringify({
      error: {
        code: 'FORMS_MANAGE_ERROR',
        message: error.message
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function listSubmissions(supabase: any, params: {
  form_id: string,
  limit?: number,
  offset?: number,
  filters?: any,
  user_id: string
}) {
  const { form_id, limit = 20, offset = 0, filters = {}, user_id } = params;
  
  // First verify user owns this form
  const { data: form, error: formError } = await supabase
    .from('forms')
    .select('id, user_id')
    .eq('id', form_id)
    .eq('user_id', user_id)
    .single();
    
  if (formError) {
    throw new Error('Form not found or access denied');
  }
  
  let query = supabase
    .from('form_submissions')
    .select('*')
    .eq('form_id', form_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Apply filters
  if (filters.status) {
    query = query.eq('processing_status', filters.status);
  }
  
  if (filters.is_public_submission !== undefined) {
    // Determine if submission is public based on submitter data
    if (filters.is_public_submission) {
      query = query.is('submitter_email', null);
    } else {
      query = query.not('submitter_email', 'is', null);
    }
  }
  
  if (filters.date_from) {
    query = query.gte('created_at', filters.date_from);
  }
  
  if (filters.date_to) {
    query = query.lte('created_at', filters.date_to);
  }

  const { data: submissions, error } = await query;
  if (error) throw error;

  // Get total count
  let countQuery = supabase
    .from('form_submissions')
    .select('*', { count: 'exact', head: true })
    .eq('form_id', form_id);
    
  if (filters.status) {
    countQuery = countQuery.eq('processing_status', filters.status);
  }

  const { count } = await countQuery;

  // Enhance submissions with public flag
  const enhancedSubmissions = (submissions || []).map(submission => ({
    ...submission,
    is_public_submission: !submission.submitter_email
  }));

  return new Response(JSON.stringify({
    success: true,
    data: {
      submissions: enhancedSubmissions,
      pagination: {
        total: count || 0,
        limit,
        offset
      }
    }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function getSubmissionDetails(supabase: any, params: { submission_id: string, user_id: string }) {
  const { submission_id, user_id } = params;
  
  // Get submission with form ownership check
  const { data: submission, error: submissionError } = await supabase
    .from('form_submissions')
    .select(`
      *,
      submission_answers!inner(*),
      forms!inner(user_id)
    `)
    .eq('id', submission_id)
    .eq('forms.user_id', user_id)
    .single();

  if (submissionError) {
    throw new Error('Submission not found or access denied');
  }

  return new Response(JSON.stringify({
    success: true,
    data: {
      submission,
      answers: submission.submission_answers || []
    }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function getCrossTableData(supabase: any, params: { submission_id: string, user_id: string }) {
  const { submission_id, user_id } = params;
  
  // Get submission with form ownership check
  const { data: submission, error: submissionError } = await supabase
    .from('form_submissions')
    .select('created_records, form_id, forms!inner(user_id)')
    .eq('id', submission_id)
    .eq('forms.user_id', user_id)
    .single();

  if (submissionError) {
    throw new Error('Submission not found or access denied');
  }

  const crossTableData: any = {};
  
  if (submission.created_records) {
    // For each table that had records created
    for (const [tableId, recordId] of Object.entries(submission.created_records)) {
      try {
        // Get table info
        const { data: table } = await supabase
          .from('better_tables')
          .select('name')
          .eq('id', tableId)
          .single();

        // Get the actual record data
        const { data: recordData } = await supabase
          .from('sheet_rows')
          .select('data, created_at')
          .eq('id', recordId)
          .single();

        if (recordData) {
          crossTableData[tableId] = {
            table_name: table?.name || 'Unknown Table',
            record_id: recordId,
            data: recordData.data,
            created_at: recordData.created_at
          };
        }
      } catch (error) {
        console.warn(`Failed to load data for table ${tableId}:`, error);
        crossTableData[tableId] = {
          table_name: 'Error loading table',
          error: error.message
        };
      }
    }
  }

  return new Response(JSON.stringify({
    success: true,
    data: crossTableData
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function deleteSubmission(supabase: any, params: { submission_id: string, user_id: string }) {
  const { submission_id, user_id } = params;
  
  // First verify user owns the form that contains this submission
  const { data: submission, error: verifyError } = await supabase
    .from('form_submissions')
    .select('id, forms!inner(user_id)')
    .eq('id', submission_id)
    .eq('forms.user_id', user_id)
    .single();
    
  if (verifyError) {
    throw new Error('Submission not found or access denied');
  }
  
  // Delete submission answers first
  await supabase
    .from('submission_answers')
    .delete()
    .eq('submission_id', submission_id);
  
  // Delete the main submission
  const { error } = await supabase
    .from('form_submissions')
    .delete()
    .eq('id', submission_id);

  if (error) throw error;

  return new Response(JSON.stringify({
    success: true,
    data: { message: 'Submission deleted successfully' }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function exportSubmissions(supabase: any, params: {
  form_id: string,
  filters?: any,
  user_id: string
}) {
  const { form_id, filters = {}, user_id } = params;
  
  // First verify user owns this form
  const { data: form, error: formError } = await supabase
    .from('forms')
    .select('id, user_id')
    .eq('id', form_id)
    .eq('user_id', user_id)
    .single();
    
  if (formError) {
    throw new Error('Form not found or access denied');
  }
  
  // Get all submissions for the form
  let query = supabase
    .from('form_submissions')
    .select(`
      *,
      submission_answers!inner(*)
    `)
    .eq('form_id', form_id)
    .order('created_at', { ascending: false });

  // Apply same filters as list
  if (filters.status) {
    query = query.eq('processing_status', filters.status);
  }
  
  if (filters.date_from) {
    query = query.gte('created_at', filters.date_from);
  }
  
  if (filters.date_to) {
    query = query.lte('created_at', filters.date_to);
  }

  const { data: submissions, error } = await query;
  if (error) throw error;

  // Format for export
  const exportData = {
    form_id,
    export_date: new Date().toISOString(),
    total_submissions: submissions?.length || 0,
    submissions: submissions || []
  };

  return new Response(JSON.stringify({
    success: true,
    data: exportData
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}