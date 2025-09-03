// Security utilities for form functions
// Provides rate limiting, CSRF protection, password hashing, and security headers

const crypto = globalThis.crypto;

// Rate limiting storage
const rateLimiter = new Map<string, { count: number; resetTime: number }>();
const csrfTokens = new Map<string, { token: string; expires: number }>();

// Rate limiting configuration
const RATE_LIMITS = {
  FORM_ACCESS: { limit: 50, windowMs: 60 * 1000 }, // 50 per minute
  FORM_SUBMIT: { limit: 10, windowMs: 60 * 1000 }, // 10 per minute
  PASSCODE_ATTEMPT: { limit: 5, windowMs: 60 * 60 * 1000 }, // 5 per hour
  ADMIN_ACTION: { limit: 100, windowMs: 60 * 1000 } // 100 per minute
};

// Security headers
export const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

/**
 * Rate limiting implementation
 */
export function checkRateLimit(
  ip: string, 
  action: keyof typeof RATE_LIMITS, 
  customLimit?: { limit: number; windowMs: number }
): { allowed: boolean; remainingAttempts?: number; resetTime?: number } {
  const config = customLimit || RATE_LIMITS[action];
  const key = `${ip}:${action}`;
  const now = Date.now();
  const entry = rateLimiter.get(key);
  
  // Clean up expired entries periodically
  if (Math.random() < 0.01) { // 1% chance
    cleanupExpiredRateLimits();
  }
  
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

/**
 * Clean up expired rate limit entries
 */
function cleanupExpiredRateLimits(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimiter.entries()) {
    if (now > entry.resetTime) {
      rateLimiter.delete(key);
    }
  }
}

/**
 * Password hashing using PBKDF2
 */
export async function hashPasscode(passcode: string): Promise<string> {
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

/**
 * Verify password against hash
 */
export async function verifyPasscode(passcode: string, hashedPasscode: string): Promise<boolean> {
  // Handle legacy plain text passcodes (migration path)
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

/**
 * Generate CSRF token
 */
export function generateCSRFToken(sessionId?: string): string {
  const token = crypto.randomUUID();
  const key = sessionId || 'global';
  
  csrfTokens.set(key, {
    token,
    expires: Date.now() + (30 * 60 * 1000) // 30 minutes
  });
  
  return token;
}

/**
 * Validate CSRF token
 */
export function validateCSRFToken(token: string, sessionId?: string): boolean {
  const key = sessionId || 'global';
  const stored = csrfTokens.get(key);
  
  if (!stored || Date.now() > stored.expires) {
    csrfTokens.delete(key);
    return false;
  }
  
  return stored.token === token;
}

/**
 * Get client IP address from request
 */
export function getClientIP(req: Request): string {
  // Try various headers that might contain the real IP
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
  
  // Fallback to a placeholder (Deno Deploy doesn't expose direct IP)
  return 'unknown';
}

/**
 * Validate request origin for CSRF protection
 */
export function validateOrigin(req: Request, allowedOrigins: string[]): boolean {
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  
  // Allow requests without origin/referer for direct API access
  if (!origin && !referer) {
    return true;
  }
  
  // Check origin
  if (origin && allowedOrigins.includes(origin)) {
    return true;
  }
  
  // Check referer domain
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

/**
 * Log security event
 */
export function logSecurityEvent(
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

/**
 * Enhanced CORS headers with security
 */
export function getSecureCorsHeaders(origin?: string): Record<string, string> {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://*.vercel.app',
    'https://*.space.minimax.io',
    'https://*.space.minimaxi.cn'
  ];
  
  const corsHeaders = {
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true'
  };
  
  // Set specific origin if provided and allowed, otherwise use restrictive policy
  if (origin && allowedOrigins.some(allowed => 
    allowed.includes('*') ? origin.includes(allowed.replace('*', '')) : origin === allowed
  )) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
  } else {
    corsHeaders['Access-Control-Allow-Origin'] = 'null';
  }
  
  return { ...corsHeaders, ...SECURITY_HEADERS };
}

/**
 * Sanitize user input to prevent injection attacks
 */
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Basic XSS prevention
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
