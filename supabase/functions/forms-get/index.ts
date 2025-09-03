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

function validateOrigin(req: Request, allowedOrigins: string[]): boolean {
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  
  if (!origin && !referer) {
    return true;
  }
  
  if (origin && allowedOrigins.includes(origin)) {
    return true;
  }
  
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const refererOrigin = refererUrl.origin;
      return allowedOrigins.includes(refererOrigin);
    } catch {
      return false;
    }
  }
  
  return false;
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

  // Rate limit form access
  const rateCheck = checkRateLimit(clientIP, 'FORM_ACCESS');
  if (!rateCheck.allowed) {
    logSecurityEvent('FORM_ACCESS_RATE_LIMIT_EXCEEDED', clientIP, { resetTime: rateCheck.resetTime });
    return new Response(JSON.stringify({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many form access requests. Please try again later.',
        resetTime: rateCheck.resetTime
      }
    }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let requestBody: any = {};
    try {
      const rawBody = await req.text();
      if (rawBody.trim()) {
        requestBody = JSON.parse(rawBody);
      }
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      throw new Error('Invalid JSON in request body');
    }

    const { form_id, public_token, password } = sanitizeInput(requestBody);

    let actualFormId = form_id;

    // If using public token, look up form ID from sharing settings
    if (public_token && !form_id) {
      const { data: sharingData, error: sharingError } = await supabase
        .from('form_sharing_settings')
        .select('form_id')
        .eq('public_url_token', public_token)
        .eq('is_public', true)
        .single();

      if (sharingError || !sharingData) {
        throw new Error('Invalid or expired public token');
      }
      
      actualFormId = sharingData.form_id;
    }

    if (!actualFormId) {
      throw new Error('Form ID or public token is required');
    }

    // Get form with questions
    const { data: form, error: formError } = await supabase
      .from('forms')
      .select(`
        *,
        form_questions!inner(*),
        form_sharing_settings(*)
      `)
      .eq('id', actualFormId)
      .single();

    if (formError) {
      if (formError.code === 'PGRST116') {
        throw new Error('Form not found');
      }
      throw formError;
    }

    if (!form.is_active) {
      throw new Error('Form is not active');
    }
    
    // Check if form is closed - moved after access validation
    const sharingSettings = form.form_sharing_settings?.[0];
    const isPublicAccess = !!public_token;

    // Enhanced access validation with password protection
    if (sharingSettings) {
      // Check password-based access control
      if (sharingSettings.access_type === 'password_protected') {
        if (!password) {
          return new Response(JSON.stringify({
            error: {
              code: 'PASSWORD_REQUIRED',
              message: 'Password required to access this form'
            }
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (password !== sharingSettings.form_password) {
          logSecurityEvent('FORM_PASSWORD_INVALID', clientIP, { form_id });
          return new Response(JSON.stringify({
            error: {
              code: 'INVALID_PASSWORD',
              message: 'Invalid password provided'
            }
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      // Check traditional private form access
      if (!isPublicAccess && !sharingSettings.is_public && sharingSettings.access_type !== 'password_protected') {
        // This is a private form, check authentication
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
          logSecurityEvent('PRIVATE_FORM_NO_AUTH', clientIP, { form_id });
          throw new Error('Authentication required for private form');
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);
        
        if (userError || !user) {
          logSecurityEvent('PRIVATE_FORM_INVALID_TOKEN', clientIP, { form_id });
          throw new Error('Invalid authentication token');
        }
        
        // Verify user owns this form
        if (form.user_id !== user.id) {
          logSecurityEvent('PRIVATE_FORM_ACCESS_DENIED', clientIP, { form_id, user_id: user.id, owner_id: form.user_id });
          throw new Error('Access denied: form not found');
        }
      }
    }
    
    // Check if form is closed
    if (sharingSettings?.close_date && new Date(sharingSettings.close_date) < new Date()) {
      throw new Error('Form has expired');
    }

    // Sort questions by order
    const questions = (form.form_questions || []).sort((a: any, b: any) => 
      a.question_order - b.question_order
    );

    // Get table and column information for each question
    const enhancedQuestions = [];
    for (const question of questions) {
      // Get table info
      const { data: table } = await supabase
        .from('better_tables')
        .select('id, name')
        .eq('id', question.target_table_id)
        .single();

      // Get column info
      const { data: column } = await supabase
        .from('columns')
        .select('id, name, data_type, type')
        .eq('id', question.target_column_id)
        .single();

      enhancedQuestions.push({
        ...question,
        target_table: table || { id: question.target_table_id, name: 'Unknown Table' },
        target_column: column || { 
          id: question.target_column_id, 
          name: 'Unknown Column',
          data_type: 'text'
        }
      });
    }

    // Build cross-table mapping info
    const crossTableMapping: any = {};
    enhancedQuestions.forEach(q => {
      if (!crossTableMapping[q.target_table.id]) {
        crossTableMapping[q.target_table.id] = {
          table_name: q.target_table.name,
          columns: []
        };
      }
      crossTableMapping[q.target_table.id].columns.push({
        column_id: q.target_column.id,
        column_name: q.target_column.name,
        question_id: q.id
      });
    });

    const formData = {
      ...form,
      questions: enhancedQuestions,
      cross_table_mapping: crossTableMapping,
      is_public_access: isPublicAccess,
      sharing_settings: sharingSettings
    };

    logSecurityEvent('FORM_ACCESS_SUCCESS', clientIP, { form_id, is_public: isPublicAccess });

    return new Response(JSON.stringify({
      success: true,
      data: formData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error getting form:', error);
    
    // Ensure CORS headers are available even if they weren't set earlier
    const safeCorsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
      'Access-Control-Max-Age': '86400',
      'Access-Control-Allow-Credentials': 'false'
    };
    
    try {
      const requestBody = await req.text();
      const parsedBody = requestBody ? JSON.parse(requestBody) : {};
      
      logSecurityEvent('FORM_ACCESS_ERROR', clientIP, { 
        form_id: parsedBody?.form_id, 
        error: error.message 
      });
    } catch (logError) {
      console.error('Error in error logging:', logError);
    }
    
    return new Response(JSON.stringify({
      error: {
        code: 'FORM_GET_ERROR',
        message: error.message
      }
    }), {
      status: error.message === 'Form not found' ? 404 : 500,
      headers: { ...safeCorsHeaders, 'Content-Type': 'application/json' }
    });
  }
});