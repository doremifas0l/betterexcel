import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Inlined security utilities to avoid external dependencies
const rateLimiter = new Map<string, { count: number; resetTime: number }>();
const csrfTokens = new Map<string, { token: string; expires: number }>();

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

function validateCSRFToken(token: string, sessionId?: string): boolean {
  const key = sessionId || 'global';
  const stored = csrfTokens.get(key);
  
  if (!stored || Date.now() > stored.expires) {
    csrfTokens.delete(key);
    return false;
  }
  
  return stored.token === token;
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

  // Rate limit enhanced form submissions
  const rateCheck = checkRateLimit(clientIP, 'FORM_SUBMIT');
  if (!rateCheck.allowed) {
    logSecurityEvent('FORM_SUBMIT_ENHANCED_RATE_LIMIT_EXCEEDED', clientIP, { resetTime: rateCheck.resetTime });
    return new Response(JSON.stringify({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many submission attempts. Please try again later.',
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

    const requestBody = await req.json();
    const { 
      form_id, 
      submission_data, 
      submitter_email, 
      submitter_ip,
      user_agent,
      bypass_duplicate_check = false,
      csrf_token
    } = sanitizeInput(requestBody);

    // CSRF protection for enhanced submissions
    if (csrf_token && !validateCSRFToken(csrf_token)) {
      logSecurityEvent('CSRF_TOKEN_INVALID', clientIP, { form_id });
      return new Response(JSON.stringify({
        error: {
          code: 'INVALID_CSRF_TOKEN',
          message: 'Invalid or missing CSRF token'
        }
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!form_id || !submission_data) {
      throw new Error('Form ID and submission data are required');
    }

    // Check if form is open for submissions
    const formStatusCheck = await supabase.functions.invoke('forms-advanced', {
      body: { action: 'check_form_status', form_id }
    });

    if (formStatusCheck.error || !formStatusCheck.data?.data?.is_open) {
      const message = formStatusCheck.data?.data?.closed_message || 'Form is closed';
      return new Response(JSON.stringify({
        error: {
          code: 'FORM_CLOSED',
          message
        }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let submissionStatus = 'new';
    let invalidReasons: any = {};
    let duplicateOf: string | null = null;
    let stagingRequired = false;

    // Check for duplicates if not bypassed
    if (!bypass_duplicate_check) {
      const duplicateCheck = await supabase.functions.invoke('forms-advanced', {
        body: { 
          action: 'check_duplicates', 
          form_id, 
          submission_data 
        }
      });

      if (duplicateCheck.data?.data?.is_duplicate) {
        submissionStatus = 'flagged_duplicate';
        invalidReasons.duplicate = duplicateCheck.data.data.duplicate_reasons;
        duplicateOf = duplicateCheck.data.data.duplicate_of;
        stagingRequired = true;
      }
    }

    // Basic validation
    const validationErrors = await validateSubmissionData(supabase, form_id, submission_data);
    if (Object.keys(validationErrors).length > 0) {
      submissionStatus = 'flagged_invalid';
      invalidReasons.validation = validationErrors;
      stagingRequired = true;
    }

    // Decide whether to stage or process directly
    if (stagingRequired) {
      // Add to staging table for manual review
      const { data: stagingSubmission, error: stagingError } = await supabase
        .from('form_submissions_staging')
        .insert({
          form_id,
          submission_data,
          submitter_email,
          submitter_ip: submitter_ip || clientIP,
          user_agent,
          validation_status: submissionStatus.includes('invalid') ? 'invalid' : 'flagged',
          validation_errors: invalidReasons,
          duplicate_of: duplicateOf,
          stage_reason: duplicateOf ? 'duplicate_detected' : 'validation_failed'
        })
        .select()
        .maybeSingle();

      if (stagingError) throw stagingError;

      logSecurityEvent('FORM_SUBMIT_ENHANCED_STAGED', clientIP, { 
        form_id, 
        submission_id: stagingSubmission.id, 
        stage_reason: duplicateOf ? 'duplicate_detected' : 'validation_failed'
      });

      return new Response(JSON.stringify({
        success: true,
        data: {
          submission_id: stagingSubmission.id,
          status: 'staged',
          message: 'Submission staged for review due to validation issues',
          issues: invalidReasons
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Process directly - create main submission
    const { data: submission, error: submissionError } = await supabase
      .from('form_submissions')
      .insert({
        form_id,
        status: submissionStatus,
        submission_data,
        submitter_email,
        submitter_ip: submitter_ip || clientIP,
        user_agent,
        processing_status: 'pending',
        invalid_reasons: Object.keys(invalidReasons).length > 0 ? invalidReasons : null
      })
      .select()
      .maybeSingle();

    if (submissionError) throw submissionError;

    // Trigger form processing
    try {
      await supabase.functions.invoke('forms-submit', {
        body: {
          submission_id: submission.id,
          form_id,
          answers: submission_data
        }
      });
    } catch (processingError) {
      console.warn('Form processing failed:', processingError);
      // Update submission with processing error
      await supabase
        .from('form_submissions')
        .update({ 
          processing_status: 'failed',
          error_details: { processing_error: processingError.message }
        })
        .eq('id', submission.id);
    }

    logSecurityEvent('FORM_SUBMIT_ENHANCED_SUCCESS', clientIP, { 
      form_id, 
      submission_id: submission.id, 
      status: submissionStatus
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        submission_id: submission.id,
        status: submissionStatus,
        message: 'Submission received and processing started'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in forms-submit-enhanced:', error);
    
    // Ensure we have corsHeaders available in catch block
    const fallbackCorsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
      'Content-Type': 'application/json'
    };
    
    let safeFormId = 'unknown';
    try {
      const body = await req.clone().json();
      safeFormId = body?.form_id || 'unknown';
    } catch {
      // Ignore json parsing errors in error handler
    }
    
    logSecurityEvent('FORM_SUBMIT_ENHANCED_ERROR', clientIP, { 
      form_id: safeFormId, 
      error: error.message 
    });
    
    return new Response(JSON.stringify({
      error: {
        code: 'SUBMISSION_ERROR',
        message: error.message
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, ...fallbackCorsHeaders }
    });
  }
});

async function validateSubmissionData(supabase: any, formId: string, submissionData: any): Promise<any> {
  const errors: any = {};
  
  // Get form questions for validation
  const { data: questions, error: questionsError } = await supabase
    .from('form_questions')
    .select('*')
    .eq('form_id', formId)
    .eq('is_visible', true);

  if (questionsError || !questions) {
    return errors;
  }

  for (const question of questions) {
    const value = submissionData[question.id];
    
    // Check required fields
    if (question.is_required && (!value || value.toString().trim() === '')) {
      errors[question.id] = `${question.question_label} is required`;
      continue;
    }
    
    if (!value) continue;
    
    // Validate email format
    if (question.question_type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        errors[question.id] = 'Invalid email format';
      }
    }
    
    // Validate number format
    if (question.question_type === 'number') {
      if (isNaN(Number(value))) {
        errors[question.id] = 'Must be a valid number';
      }
    }
    
    // Validate date format
    if (question.question_type === 'date' || question.question_type === 'datetime') {
      if (isNaN(Date.parse(value))) {
        errors[question.id] = 'Invalid date format';
      }
    }
  }
  
  return errors;
}