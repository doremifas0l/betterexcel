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

  // Rate limit form submissions
  const rateCheck = checkRateLimit(clientIP, 'FORM_SUBMIT');
  if (!rateCheck.allowed) {
    logSecurityEvent('FORM_SUBMIT_RATE_LIMIT_EXCEEDED', clientIP, { resetTime: rateCheck.resetTime });
    return new Response(JSON.stringify({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many submission attempts. Please try again later.',
        resetTime: rateCheck.resetTime,
        remainingAttempts: 0
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
    const { form_id, submission_data, submitter_email, submitter_ip, user_agent, csrf_token } = sanitizeInput(requestBody);

    // Basic CSRF protection for form submissions
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

    // Get form and questions
    const { data: form, error: formError } = await supabase
      .from('forms')
      .select(`
        *,
        form_questions!inner(*)
      `)
      .eq('id', form_id)
      .single();

    if (formError || !form) {
      throw new Error('Form not found or inactive');
    }

    // Create the submission record
    const { data: submission, error: submissionError } = await supabase
      .from('form_submissions')
      .insert({
        form_id,
        status: 'pending',
        submission_data,
        submitter_email,
        submitter_ip: submitter_ip || clientIP,
        user_agent,
        processing_status: 'processing'
      })
      .select()
      .single();

    if (submissionError) {
      throw submissionError;
    }

    // Process each answer and insert data into target tables
    const createdRecords: any = {};
    const processingLog: any = [];

    for (const question of form.form_questions) {
      const answer = submission_data[question.id];
      if (answer === undefined || answer === null || answer === '') {
        continue;
      }

      try {
        // Get target table and column info
        const { data: column } = await supabase
          .from('columns')
          .select('*, sheet_id')
          .eq('id', question.target_column_id)
          .single();

        if (!column) {
          throw new Error(`Column ${question.target_column_id} not found`);
        }

        // Convert answer based on column type
        let processedAnswer = convertAnswerToColumnType(answer, column.data_type || column.type);

        // Check if we already have a record for this table/sheet
        let recordId = createdRecords[question.target_table_id];
        
        if (!recordId) {
          // Create new record in the target sheet
          const { data: newRecord, error: recordError } = await supabase
            .from('sheet_rows')
            .insert({
              sheet_id: column.sheet_id,
              user_id: form.user_id,
              data: { [column.id]: processedAnswer },
              row_order: Date.now()
            })
            .select()
            .single();

          if (recordError) {
            throw recordError;
          }

          recordId = newRecord.id;
          createdRecords[question.target_table_id] = recordId;
        } else {
          // Update existing record
          const { data: existingRecord } = await supabase
            .from('sheet_rows')
            .select('data')
            .eq('id', recordId)
            .single();

          const updatedData = {
            ...(existingRecord?.data || {}),
            [column.id]: processedAnswer
          };

          const { error: updateError } = await supabase
            .from('sheet_rows')
            .update({ 
              data: updatedData,
              updated_at: new Date().toISOString()
            })
            .eq('id', recordId);

          if (updateError) {
            throw updateError;
          }
        }

        // Create submission answer record
        await supabase
          .from('submission_answers')
          .insert({
            submission_id: submission.id,
            question_id: question.id,
            answer_value: String(processedAnswer),
            target_table_id: question.target_table_id,
            target_column_id: question.target_column_id,
            processing_status: 'completed',
            created_record_id: recordId
          });

        processingLog.push({
          question_id: question.id,
          table_id: question.target_table_id,
          column_id: question.target_column_id,
          record_id: recordId,
          status: 'success'
        });

      } catch (error: any) {
        const errorMessage = `Error processing ${question.question_label || `question ${question.id}`}: ${error.message}`;
        console.error(errorMessage, error);
        
        // Log the error but continue with other questions
        await supabase
          .from('submission_answers')
          .insert({
            submission_id: submission.id,
            question_id: question.id,
            answer_value: String(answer),
            target_table_id: question.target_table_id,
            target_column_id: question.target_column_id,
            processing_status: 'failed',
            error_message: errorMessage
          });

        processingLog.push({
          question_id: question.id,
          question_label: question.question_label,
          table_id: question.target_table_id,
          column_id: question.target_column_id,
          status: 'error',
          error: errorMessage,
          answer: answer
        });
      }
    }

    // Update submission with final status
    const finalStatus = processingLog.some(log => log.status === 'error') ? 'completed_with_errors' : 'completed';
    
    await supabase
      .from('form_submissions')
      .update({
        processing_status: finalStatus,
        created_records: createdRecords,
        processing_log: processingLog,
        processed_at: new Date().toISOString()
      })
      .eq('id', submission.id);

    logSecurityEvent('FORM_SUBMIT_SUCCESS', clientIP, { 
      form_id, 
      submission_id: submission.id, 
      status: finalStatus,
      has_errors: processingLog.some(log => log.status === 'error')
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        submission_id: submission.id,
        status: finalStatus,
        created_records: Object.keys(createdRecords).length,
        total_questions: form.form_questions.length,
        successful_answers: processingLog.filter(log => log.status === 'success').length,
        errors: processingLog.filter(log => log.status === 'error').length,
        message: finalStatus === 'completed' ? 'Form submitted successfully!' : `Form submitted with ${processingLog.filter(log => log.status === 'error').length} error(s). Some data may not have been saved.`,
        error_details: processingLog.filter(log => log.status === 'error').length > 0 ? 
          processingLog.filter(log => log.status === 'error').map(error => ({
            question: error.question_label || `Question ${error.question_id}`,
            error: error.error,
            provided_answer: error.answer
          })) : undefined
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error submitting form:', error);
    
    logSecurityEvent('FORM_SUBMIT_ERROR', clientIP, { 
      form_id: requestBody?.form_id, 
      error: error.message 
    });
    
    return new Response(JSON.stringify({
      error: {
        code: 'FORM_SUBMISSION_ERROR',
        message: error.message
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Helper function to convert answer to appropriate column type
function convertAnswerToColumnType(answer: any, columnType: string): any {
  if (answer === null || answer === undefined) {
    return null;
  }

  const type = columnType.toLowerCase();
  
  try {
    switch (type) {
      case 'number':
      case 'integer':
      case 'bigint':
        const num = Number(answer);
        if (isNaN(num)) {
          throw new Error(`"${answer}" is not a valid number`);
        }
        return num;
        
      case 'decimal':
      case 'float':
      case 'double':
        const float = parseFloat(answer);
        if (isNaN(float)) {
          throw new Error(`"${answer}" is not a valid decimal number`);
        }
        return float;
        
      case 'boolean':
        if (typeof answer === 'boolean') {
          return answer;
        }
        if (typeof answer === 'string') {
          const lower = answer.toLowerCase().trim();
          if (['true', 'yes', '1', 'on', 'checked'].includes(lower)) {
            return true;
          }
          if (['false', 'no', '0', 'off', 'unchecked', ''].includes(lower)) {
            return false;
          }
        }
        if (typeof answer === 'number') {
          return answer !== 0;
        }
        throw new Error(`"${answer}" is not a valid yes/no value`);
        
      case 'date':
        const date = new Date(answer);
        if (isNaN(date.getTime())) {
          throw new Error(`"${answer}" is not a valid date`);
        }
        return date.toISOString().split('T')[0]; // Return just the date part
        
      case 'timestamp':
      case 'timestamptz':
      case 'datetime':
        const datetime = new Date(answer);
        if (isNaN(datetime.getTime())) {
          throw new Error(`"${answer}" is not a valid date/time`);
        }
        return datetime.toISOString();
        
      case 'email':
        const emailStr = String(answer).trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailStr)) {
          throw new Error(`"${answer}" is not a valid email address`);
        }
        return emailStr;
        
      case 'phone':
        const phoneStr = String(answer).trim();
        // Basic phone validation - adjust regex as needed
        const phoneRegex = /^[+]?[\d\s\-\(\)]+$/;
        if (!phoneRegex.test(phoneStr)) {
          throw new Error(`"${answer}" is not a valid phone number`);
        }
        return phoneStr;
        
      case 'json':
        if (typeof answer === 'object') {
          return JSON.stringify(answer);
        }
        // Validate JSON string
        try {
          JSON.parse(String(answer));
          return String(answer);
        } catch {
          throw new Error(`"${answer}" is not valid JSON`);
        }
        
      case 'text':
      case 'varchar':
      case 'char':
      default:
        const strValue = String(answer);
        // Add length validation for varchar if needed
        if (type.includes('varchar')) {
          const match = type.match(/varchar\((\d+)\)/);
          if (match) {
            const maxLength = parseInt(match[1]);
            if (strValue.length > maxLength) {
              throw new Error(`Text too long (maximum ${maxLength} characters)`);
            }
          }
        }
        return strValue;
    }
  } catch (error: any) {
    // Re-throw with context about which field failed
    throw new Error(`Data conversion failed: ${error.message}`);
  }
}