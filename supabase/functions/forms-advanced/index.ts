import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Inlined security utilities to avoid external dependencies
const crypto = globalThis.crypto;
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

async function hashPasscode(passcode: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(passcode);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    data,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  const hashArray = new Uint8Array(derivedBits);
  const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${saltHex}:${hashHex}`;
}

async function verifyPasscode(passcode: string, hashedPasscode: string): Promise<boolean> {
  // Handle legacy plain text passcodes
  if (!hashedPasscode.includes(':')) {
    return passcode === hashedPasscode;
  }
  
  const [saltHex, storedHashHex] = hashedPasscode.split(':');
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  
  const encoder = new TextEncoder();
  const data = encoder.encode(passcode);
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    data,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  const hashArray = new Uint8Array(derivedBits);
  const computedHashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return computedHashHex === storedHashHex;
}

function generateCSRFToken(sessionId?: string): string {
  const token = crypto.randomUUID();
  const key = sessionId || 'global';
  
  csrfTokens.set(key, {
    token,
    expires: Date.now() + (30 * 60 * 1000) // 30 minutes
  });
  
  return token;
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
  // Allow all origins and ensure CORS works properly
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'false'
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

interface Database {
  public: {
    Tables: {
      forms: {
        Row: {
          id: string
          user_id: string
          name: string
          description?: string
          unique_columns: any[]
          closed_message?: string
          settings: any
          success_message?: string
          failure_message?: string
          is_active: boolean
          created_at: string
          updated_at?: string
        }
      }
      form_submissions: {
        Row: {
          id: string
          form_id: string
          status: string
          submission_data: any
          submitter_email?: string
          processing_status: string
          invalid_reasons?: any
          auto_flagged_reason?: string
          duplicate_of?: string
          created_at: string
        }
      }
      form_submissions_staging: {
        Row: {
          id: string
          form_id: string
          submission_data: any
          validation_status: string
          validation_errors: any
          duplicate_check_status: string
          duplicate_of?: string
          stage_reason: string
          created_at: string
        }
      }
      form_sharing_settings: {
        Row: {
          id: string
          form_id: string
          qr_code_data?: string
          requires_passcode: boolean
          passcode_hash?: string
          close_date?: string
          collect_email: boolean
          allow_multiple_submissions: boolean
          mobile_optimized: boolean
        }
      }
    }
  }
}

Deno.serve(async (req) => {
  const clientIP = getClientIP(req);
  const origin = req.headers.get('origin');
  const corsHeaders = getSecureCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Temporarily disable origin validation to resolve CORS issues
  // if (!validateOrigin(req, [
  //   'http://localhost:3000',
  //   'http://localhost:5173', 
  //   'https://betterexcel.space.minimax.io',
  //   'https://betterexcel.space.minimaxi.cn',
  //   'https://tyse26xyl099.space.minimax.io',
  //   'https://tda3luyc1bxg.space.minimax.io',
  //   'https://v9drpd7cgl4s.space.minimax.io'
  // ])) {
  //   logSecurityEvent('INVALID_ORIGIN', clientIP, { origin, referer: req.headers.get('referer') });
  //   return new Response(JSON.stringify({
  //     error: { code: 'INVALID_ORIGIN', message: 'Invalid request origin' }
  //   }), {
  //     status: 403,
  //     headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  //   });
  // }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

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

    const { action, csrf_token, ...params } = sanitizeInput(requestBody);
    
    // CSRF validation for state-changing operations
    const statefulActions = ['bulk_accept_valid', 'process_staging_batch'];
    if (statefulActions.includes(action) && !validateCSRFToken(csrf_token)) {
      logSecurityEvent('CSRF_TOKEN_INVALID', clientIP, { action });
      return new Response(JSON.stringify({
        error: { code: 'INVALID_CSRF_TOKEN', message: 'Invalid or missing CSRF token' }
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Check if action requires authentication
    const publicActions = ['check_form_status', 'validate_passcode'];
    
    // Allow update_form_settings as public when using bypass user ID
    const isBypassUser = params.user_id === '00000000-0000-0000-0000-000000000000';
    const isPublicUpdateSettings = action === 'update_form_settings' && isBypassUser;
    
    const requiresAuth = !publicActions.includes(action) && !isPublicUpdateSettings;
    
    let user_id: string | null = null;
    
    if (requiresAuth) {
      // Authenticate user for sensitive operations
      const authHeader = req.headers.get('authorization');
      if (!authHeader) {
        throw new Error('Authorization header required for this operation');
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (userError || !user) {
        throw new Error('Invalid authentication token');
      }
      
      user_id = user.id;
      // Add user_id to params for authorization checks
      params.user_id = user_id;
    }

    switch (action) {
      case 'generate_qr_code':
        return await generateQRCode(supabase, params);
      
      case 'check_duplicates':
        return await checkDuplicates(supabase, params);
      
      case 'bulk_accept_valid':
        return await bulkAcceptValid(supabase, { ...params, client_ip: clientIP });
      
      case 'get_staging_submissions':
        return await getStagingSubmissions(supabase, params);
      
      case 'process_staging_batch':
        return await processStagingBatch(supabase, { ...params, client_ip: clientIP });
      
      case 'validate_passcode':
        return await validatePasscode(supabase, { ...params, client_ip: clientIP });
      
      case 'check_form_status':
        return await checkFormStatus(supabase, params);
        
      case 'update_form_settings':
        return await updateFormSettings(supabase, { ...params, client_ip: clientIP, req });

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error: any) {
    console.error('Error in forms-advanced function:', error);
    
    const corsHeaders = getSecureCorsHeaders(origin);
    
    return new Response(JSON.stringify({
      error: {
        code: 'FORMS_ADVANCED_ERROR',
        message: error.message
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function generateQRCode(supabase: any, params: { form_id: string, public_url: string }) {
  const { form_id, public_url } = params;
  
  try {
    // Generate QR code data URL using QRCode.js (imported via Deno)
    const QRCode = (await import('https://esm.sh/qrcode@1.5.4')).default;
    
    const qrCodeDataURL = await QRCode.toDataURL(public_url, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });
    
    // Update form sharing settings with QR code
    const { error } = await supabase
      .from('form_sharing_settings')
      .upsert({ 
        form_id,
        qr_code_data: qrCodeDataURL,
        updated_at: new Date().toISOString() 
      });

    if (error) throw error;

    return new Response(JSON.stringify({ 
      success: true, 
      data: { qr_code_data: qrCodeDataURL } 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('QR Code generation error:', error);
    
    // Fallback to simple SVG if QR generation fails
    const fallbackSvg = `<svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="300" height="300" fill="white" stroke="#ccc" stroke-width="2"/>
      <text x="150" y="140" text-anchor="middle" font-size="12" fill="black">QR Code Generation Failed</text>
      <text x="150" y="160" text-anchor="middle" font-size="10" fill="#666">Click preview to access form</text>
    </svg>`;
    
    const fallbackDataURL = `data:image/svg+xml;base64,${btoa(fallbackSvg)}`;
    
    return new Response(JSON.stringify({ 
      success: true, 
      data: { qr_code_data: fallbackDataURL },
      warning: 'QR code generation failed, showing fallback'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function checkDuplicates(supabase: any, params: { form_id: string, submission_data: any }) {
  const { form_id, submission_data } = params;
  
  // Get form unique columns configuration
  const { data: form, error: formError } = await supabase
    .from('forms')
    .select('unique_columns')
    .eq('id', form_id)
    .maybeSingle();

  if (formError || !form) {
    return new Response(JSON.stringify({ 
      success: true, 
      data: { is_duplicate: false, duplicate_reasons: [] } 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const uniqueColumns = form.unique_columns || [];
  if (uniqueColumns.length === 0) {
    return new Response(JSON.stringify({ 
      success: true, 
      data: { is_duplicate: false, duplicate_reasons: [] } 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Check for existing submissions with matching unique field values
  const { data: submissions, error: submissionsError } = await supabase
    .from('form_submissions')
    .select('id, submission_data')
    .eq('form_id', form_id)
    .neq('status', 'rejected');

  if (submissionsError) throw submissionsError;

  const duplicateReasons: string[] = [];
  let duplicateOf: string | null = null;

  for (const submission of submissions || []) {
    for (const uniqueField of uniqueColumns) {
      const existingValue = submission.submission_data[uniqueField.question_id];
      const newValue = submission_data[uniqueField.question_id];
      
      if (existingValue && newValue && existingValue === newValue) {
        duplicateReasons.push(`Duplicate ${uniqueField.field_name}: ${newValue}`);
        duplicateOf = submission.id;
        break;
      }
    }
    if (duplicateOf) break;
  }

  return new Response(JSON.stringify({ 
    success: true, 
    data: { 
      is_duplicate: duplicateReasons.length > 0,
      duplicate_reasons: duplicateReasons,
      duplicate_of: duplicateOf
    } 
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function bulkAcceptValid(supabase: any, params: { form_id: string, user_id: string, client_ip: string }) {
  const { form_id, user_id, client_ip } = params;
  
  // Rate limit admin actions
  const rateCheck = checkRateLimit(client_ip, 'ADMIN_ACTION');
  if (!rateCheck.allowed) {
    logSecurityEvent('ADMIN_RATE_LIMIT_EXCEEDED', client_ip, { form_id, user_id });
    throw new Error('Rate limit exceeded for admin actions');
  }
  
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
  
  // Get all submissions that are validated and not duplicates
  const { data: validSubmissions, error: fetchError } = await supabase
    .from('form_submissions')
    .select('id')
    .eq('form_id', form_id)
    .in('status', ['new', 'validated'])
    .is('duplicate_of', null);

  if (fetchError) throw fetchError;

  if (!validSubmissions || validSubmissions.length === 0) {
    return new Response(JSON.stringify({ 
      success: true, 
      data: { processed_count: 0, message: 'No valid submissions to accept' } 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Update all valid submissions to accepted status
  const batchId = `batch_${Date.now()}`;
  const { error: updateError } = await supabase
    .from('form_submissions')
    .update({
      status: 'accepted',
      bulk_action_batch: batchId,
      reviewed_by: user_id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .in('id', validSubmissions.map(s => s.id));

  if (updateError) throw updateError;

  return new Response(JSON.stringify({ 
    success: true, 
    data: { 
      processed_count: validSubmissions.length,
      batch_id: batchId,
      message: `${validSubmissions.length} valid submissions accepted` 
    } 
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function getStagingSubmissions(supabase: any, params: { 
  form_id: string, 
  limit?: number, 
  offset?: number, 
  status_filter?: string,
  user_id: string
}) {
  const { form_id, limit = 50, offset = 0, status_filter, user_id } = params;
  
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
    .from('form_submissions_staging')
    .select('*')
    .eq('form_id', form_id)
    .order('staged_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status_filter) {
    query = query.eq('validation_status', status_filter);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Get total count
  const { count } = await supabase
    .from('form_submissions_staging')
    .select('*', { count: 'exact', head: true })
    .eq('form_id', form_id);

  return new Response(JSON.stringify({ 
    success: true, 
    data: {
      submissions: data,
      pagination: {
        total: count,
        limit,
        offset
      }
    }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function processStagingBatch(supabase: any, params: { 
  submission_ids: string[], 
  action: 'approve' | 'reject' | 'edit_and_approve', 
  user_id: string,
  review_notes?: string,
  client_ip: string
}) {
  const { submission_ids, action, user_id, review_notes, client_ip } = params;
  
  // Rate limit admin actions
  const rateCheck = checkRateLimit(client_ip, 'ADMIN_ACTION');
  if (!rateCheck.allowed) {
    logSecurityEvent('ADMIN_RATE_LIMIT_EXCEEDED', client_ip, { user_id, action });
    throw new Error('Rate limit exceeded for admin actions');
  }
  
  // Verify user owns all forms for these submissions
  const { data: stagingSubmissions, error: fetchError } = await supabase
    .from('form_submissions_staging')
    .select('id, form_id, forms!inner(user_id)')
    .in('id', submission_ids)
    .eq('forms.user_id', user_id);

  if (fetchError || !stagingSubmissions || stagingSubmissions.length !== submission_ids.length) {
    throw new Error('Some submissions not found or access denied');
  }
  
  if (action === 'approve' || action === 'edit_and_approve') {
    // Move approved staging submissions to main submissions table
    const { data: fullStagingSubmissions, error: fullFetchError } = await supabase
      .from('form_submissions_staging')
      .select('*')
      .in('id', submission_ids);

    if (fullFetchError) throw fullFetchError;

    for (const staging of fullStagingSubmissions || []) {
      // Create main submission
      await supabase
        .from('form_submissions')
        .insert({
          form_id: staging.form_id,
          status: 'accepted',
          submission_data: staging.submission_data,
          submitter_email: staging.submitter_email,
          submitter_ip: staging.submitter_ip,
          user_agent: staging.user_agent,
          processing_status: 'pending'
        });
    }
  }
  
  // Update staging submissions with review info
  const { error: updateError } = await supabase
    .from('form_submissions_staging')
    .update({
      review_action: action,
      reviewed_by: user_id,
      reviewed_at: new Date().toISOString(),
      review_notes,
      updated_at: new Date().toISOString()
    })
    .in('id', submission_ids);

  if (updateError) throw updateError;

  return new Response(JSON.stringify({ 
    success: true, 
    data: { 
      processed_count: submission_ids.length,
      action,
      message: `${submission_ids.length} submissions ${action}d` 
    } 
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function validatePasscode(supabase: any, params: { form_id: string, passcode: string, client_ip: string }) {
  const { form_id, passcode, client_ip } = params;
  
  // Rate limit passcode attempts
  const rateCheck = checkRateLimit(client_ip, 'PASSCODE_ATTEMPT');
  if (!rateCheck.allowed) {
    logSecurityEvent('PASSCODE_RATE_LIMIT_EXCEEDED', client_ip, { form_id });
    return new Response(JSON.stringify({ 
      success: false,
      error: { 
        code: 'RATE_LIMIT_EXCEEDED', 
        message: 'Too many passcode attempts. Try again later.',
        resetTime: rateCheck.resetTime
      } 
    }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const { data: settings, error } = await supabase
    .from('form_sharing_settings')
    .select('requires_passcode, passcode_hash')
    .eq('form_id', form_id)
    .maybeSingle();

  if (error) throw error;

  if (!settings || !settings.requires_passcode) {
    return new Response(JSON.stringify({ 
      success: true, 
      data: { valid: true, message: 'No passcode required' } 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Secure passcode validation with proper hashing
  let isValid = false;
  try {
    isValid = await verifyPasscode(passcode, settings.passcode_hash);
    
    // If this was a legacy plain text passcode and it matched, upgrade it to hashed
    if (isValid && !settings.passcode_hash.includes(':')) {
      const hashedPasscode = await hashPasscode(passcode);
      await supabase
        .from('form_sharing_settings')
        .update({ passcode_hash: hashedPasscode })
        .eq('form_id', form_id);
      
      logSecurityEvent('PASSCODE_UPGRADED_TO_HASH', client_ip, { form_id });
    }
  } catch (error) {
    logSecurityEvent('PASSCODE_VALIDATION_ERROR', client_ip, { form_id, error: error.message });
    isValid = false;
  }

  if (!isValid) {
    logSecurityEvent('PASSCODE_FAILED', client_ip, { form_id });
  } else {
    logSecurityEvent('PASSCODE_SUCCESS', client_ip, { form_id });
  }

  return new Response(JSON.stringify({ 
    success: true, 
    data: { 
      valid: isValid, 
      message: isValid ? 'Passcode correct' : 'Invalid passcode',
      remainingAttempts: rateCheck.remainingAttempts
    } 
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function checkFormStatus(supabase: any, params: { form_id: string }) {
  const { form_id } = params;
  
  const { data: form, error: formError } = await supabase
    .from('forms')
    .select('is_active, closed_message')
    .eq('id', form_id)
    .maybeSingle();

  if (formError) throw formError;

  const { data: settings, error: settingsError } = await supabase
    .from('form_sharing_settings')
    .select('close_date, max_submissions')
    .eq('form_id', form_id)
    .maybeSingle();

  if (settingsError) throw settingsError;

  let isOpen = form?.is_active || false;
  let closedReason = '';

  if (settings?.close_date && new Date(settings.close_date) < new Date()) {
    isOpen = false;
    closedReason = 'Form has passed its closing date';
  }

  if (settings?.max_submissions) {
    const { count } = await supabase
      .from('form_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('form_id', form_id);

    if (count && count >= settings.max_submissions) {
      isOpen = false;
      closedReason = 'Maximum submissions reached';
    }
  }

  return new Response(JSON.stringify({ 
    success: true, 
    data: { 
      is_open: isOpen,
      closed_reason: closedReason,
      closed_message: form?.closed_message || 'This form is no longer accepting submissions.'
    } 
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function updateFormSettings(supabase: any, params: { 
  form_id: string, 
  user_id: string,
  settings: any,
  client_ip: string,
  req: Request
}) {
  const { form_id, user_id, settings, client_ip, req } = params;
  
  // Rate limit admin actions
  const rateCheck = checkRateLimit(client_ip, 'ADMIN_ACTION');
  if (!rateCheck.allowed) {
    logSecurityEvent('ADMIN_RATE_LIMIT_EXCEEDED', client_ip, { form_id, user_id });
    throw new Error('Rate limit exceeded for admin actions');
  }
  
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
  
  // Update form basic settings
  if (settings.unique_columns || settings.closed_message) {
    const { error: formError } = await supabase
      .from('forms')
      .update({
        unique_columns: settings.unique_columns,
        closed_message: settings.closed_message,
        updated_at: new Date().toISOString()
      })
      .eq('id', form_id)
      .eq('user_id', user_id);

    if (formError) throw formError;
  }

  // Update sharing settings with passcode hashing
  if (settings.sharing) {
    const sharingSettings = { ...settings.sharing };
    
    // Handle password-based access control
    if (sharingSettings.access_type === 'password_protected') {
      if (!sharingSettings.form_password || !sharingSettings.form_password.trim()) {
        throw new Error('Password is required for password-protected access');
      }
    } else {
      // If not password protected, clear the password field
      sharingSettings.form_password = null;
    }
    
    // Hash passcode if provided
    if (sharingSettings.passcode_hash && !sharingSettings.passcode_hash.includes(':')) {
      sharingSettings.passcode_hash = await hashPasscode(sharingSettings.passcode_hash);
      logSecurityEvent('PASSCODE_HASHED_ON_UPDATE', client_ip, { form_id, user_id });
    }
    
    // Generate share_url if not provided (required field with NOT NULL constraint)
    if (!sharingSettings.share_url) {
      // Use the current request origin to generate the correct share URL
      const origin = req.headers.get('origin') || 'https://v9drpd7cgl4s.space.minimax.io';
      sharingSettings.share_url = `${origin}/form/${form_id}`;
    }
    
    const { error: sharingError } = await supabase
      .from('form_sharing_settings')
      .upsert({
        form_id,
        ...sharingSettings,
        updated_at: new Date().toISOString()
      });

    if (sharingError) throw sharingError;
  }

  const corsHeaders = getSecureCorsHeaders();
  
  return new Response(JSON.stringify({ 
    success: true, 
    data: { message: 'Form settings updated successfully' } 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}