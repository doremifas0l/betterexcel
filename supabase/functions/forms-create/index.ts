import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Inline security utilities
const rateLimit = new Map();

function checkRateLimit(clientIP: string, action: string, maxRequests: number, windowMs: number): boolean {
  const key = `${clientIP}-${action}`;
  const now = Date.now();
  const windowStart = now - windowMs;
  
  if (!rateLimit.has(key)) {
    rateLimit.set(key, []);
  }
  
  const requests = rateLimit.get(key)!.filter((timestamp: number) => timestamp > windowStart);
  
  if (requests.length >= maxRequests) {
    return false;
  }
  
  requests.push(now);
  rateLimit.set(key, requests);
  
  // Clean up old entries periodically
  if (Math.random() < 0.01) {
    for (const [k, v] of rateLimit.entries()) {
      rateLimit.set(k, v.filter((timestamp: number) => timestamp > windowStart));
    }
  }
  
  return true;
}

function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0] ||
         req.headers.get('x-real-ip') ||
         req.headers.get('cf-connecting-ip') ||
         '0.0.0.0';
}

function getSecureCorsHeaders(origin: string | null): Record<string, string> {
  // Temporary: Allow all origins to resolve CORS issue
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
    'Access-Control-Max-Age': '86400',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'"
  };
}

function logSecurityEvent(event: string, clientIP: string, data: any = {}): void {
  console.log(`SECURITY: ${event}`, { clientIP, timestamp: new Date().toISOString(), ...data });
}

function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '');
  }
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
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

  // Temporarily disable rate limiting for debugging
  // const rateCheck = checkRateLimit(clientIP, 'ADMIN_ACTION', 50, 60000);
  // if (!rateCheck) {
  //   logSecurityEvent('FORM_CREATE_RATE_LIMIT_EXCEEDED', clientIP, { resetTime: Date.now() + 60000 });
  //   return new Response(JSON.stringify({
  //     error: {
  //       code: 'RATE_LIMIT_EXCEEDED',
  //       message: 'Too many form creation requests. Please try again later.',
  //       resetTime: Date.now() + 60000
  //     }
  //   }), {
  //     status: 429,
  //     headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  //   });
  // }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestBody = await req.json();
    const { 
      name, 
      description, 
      project_id, 
      success_message, 
      failure_message, 
      questions,
      settings 
    } = sanitizeInput(requestBody);

    if (!name || !project_id || !questions || questions.length === 0) {
      throw new Error('Name, project_id, and questions are required');
    }

    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid auth token');
    }

    // Create the form
    const { data: form, error: formError } = await supabase
      .from('forms')
      .insert({
        user_id: user.id,
        name,
        description,
        project_id,
        success_message: success_message || 'Thank you for your submission!',
        failure_message: failure_message || 'Sorry, there was an error with your submission.',
        settings: settings || { theme: 'default', show_progress: true },
        is_active: true,
        use_staging: false
      })
      .select()
      .single();

    if (formError) {
      throw formError;
    }

    // Create form questions
    const formQuestions = questions.map((q: any, index: number) => ({
      form_id: form.id,
      question_order: index + 1,
      question_label: q.question_label,
      question_description: q.question_description,
      help_text: q.help_text,
      is_required: q.is_required || false,
      is_visible: q.is_visible !== false,
      question_type: q.question_type,
      question_config: q.question_config || {},
      default_value: q.default_value,
      placeholder_text: q.placeholder_text,
      target_table_id: q.target_table_id,
      target_column_id: q.target_column_id,
      creates_relationship: q.creates_relationship || false,
      relationship_config: q.relationship_config || {}
    }));

    const { data: createdQuestions, error: questionsError } = await supabase
      .from('form_questions')
      .insert(formQuestions)
      .select();

    if (questionsError) {
      throw questionsError;
    }

    // Create default form sharing settings
    const shareUrl = `${req.headers.get('host') || 'localhost'}/form/${form.id}`;
    const { error: sharingError } = await supabase
      .from('form_sharing_settings')
      .insert({
        form_id: form.id,
        share_url: shareUrl,
        is_public: true,
        requires_passcode: false,
        anonymous_submissions: true,
        collect_email: false,
        allow_multiple_submissions: true,
        mobile_optimized: true
      });

    if (sharingError) {
      console.warn('Warning: Failed to create sharing settings:', sharingError);
    }

    logSecurityEvent('FORM_CREATE_SUCCESS', clientIP, { 
      form_id: form.id, 
      user_id: user.id, 
      project_id,
      question_count: createdQuestions?.length || 0
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        form: {
          ...form,
          questions: createdQuestions,
          share_url: shareUrl
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error creating form:', error);
    
    logSecurityEvent('FORM_CREATE_ERROR', clientIP, { 
      error: error.message 
    });
    
    return new Response(JSON.stringify({
      error: {
        code: 'FORM_CREATION_ERROR',
        message: error.message
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});