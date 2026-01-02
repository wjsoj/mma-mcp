/**
 * Bearer token authentication middleware for HTTP transport.
 * Validates API keys using timing-safe comparison to prevent timing attacks.
 */

import { InvalidTokenError } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';

/**
 * Timing-safe string comparison
 * Prevents timing attacks by ensuring comparison always takes the same amount of time
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 */
function timingSafeEqual(a: string, b: string): boolean {
  // If lengths differ, still do a comparison to prevent timing leak
  if (a.length !== b.length) {
    // Compare against a dummy string of the expected length
    const dummy = 'x'.repeat(b.length);
    let result = 1; // Mark as not equal

    for (let i = 0; i < b.length; i++) {
      result |= dummy.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return false;
  }

  // Constant-time comparison
  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Extract bearer token from Authorization header
 * @param request - HTTP request
 * @returns Bearer token if present, null otherwise
 */
function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return null;
  }

  // Check if it starts with 'Bearer '
  const bearerPrefix = 'Bearer ';

  if (!authHeader.startsWith(bearerPrefix)) {
    return null;
  }

  // Extract token (everything after 'Bearer ')
  const token = authHeader.slice(bearerPrefix.length).trim();

  return token.length > 0 ? token : null;
}

/**
 * Validate bearer token against expected API key
 * @param request - HTTP request
 * @param expectedKey - Expected API key (from config)
 * @returns true if token is valid, false otherwise
 */
export function validateBearerToken(
  request: Request,
  expectedKey?: string
): boolean {
  // If no API key is configured, authentication is disabled
  if (!expectedKey || expectedKey.length === 0) {
    logger.debug('[Auth] API key not configured - authentication disabled');
    return true;
  }

  // Extract token from request
  const token = extractBearerToken(request);

  if (!token) {
    logger.warn('[Auth] Missing or invalid Authorization header');
    return false;
  }

  // Validate token using timing-safe comparison
  const isValid = timingSafeEqual(token, expectedKey);

  if (isValid) {
    logger.debug('[Auth] Bearer token validated successfully');
  } else {
    logger.warn('[Auth] Invalid bearer token provided');
  }

  return isValid;
}

/**
 * Create an authentication middleware for Bun.serve
 * Returns a function that checks bearer token and throws if invalid
 * @param expectedKey - Expected API key
 * @returns Middleware function
 */
export function createAuthMiddleware(expectedKey?: string) {
  return (request: Request): void => {
    if (!validateBearerToken(request, expectedKey)) {
      throw new InvalidTokenError();
    }
  };
}

/**
 * Create a 401 Unauthorized response
 * @param message - Error message (default: 'Unauthorized')
 * @returns Response object with 401 status
 */
export function createUnauthorizedResponse(
  message: string = 'Unauthorized'
): Response {
  return new Response(
    JSON.stringify({
      error: 'Unauthorized',
      message,
      timestamp: new Date().toISOString(),
    }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Bearer realm="Mathematica MCP Server"',
      },
    }
  );
}

/**
 * Log authentication attempt
 * @param request - HTTP request
 * @param success - Whether authentication succeeded
 */
export function logAuthAttempt(request: Request, success: boolean): void {
  const method = request.method;
  const url = new URL(request.url);
  const path = url.pathname;
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

  if (success) {
    logger.info(`[Auth] Success: ${method} ${path} from ${ip}`);
  } else {
    logger.warn(`[Auth] Failed: ${method} ${path} from ${ip}`);
  }
}

/**
 * Check if API key meets security requirements
 * @param apiKey - API key to validate
 * @returns Array of warnings (empty if key is secure)
 */
export function validateApiKeySecurity(apiKey: string): string[] {
  const warnings: string[] = [];

  // Minimum length check
  if (apiKey.length < 32) {
    warnings.push(`API key is too short (${apiKey.length} characters). Recommended: at least 32 characters`);
  }

  // Character diversity check
  const hasUppercase = /[A-Z]/.test(apiKey);
  const hasLowercase = /[a-z]/.test(apiKey);
  const hasNumbers = /[0-9]/.test(apiKey);
  const hasSpecial = /[^A-Za-z0-9]/.test(apiKey);

  const diversity = [hasUppercase, hasLowercase, hasNumbers, hasSpecial].filter(Boolean).length;

  if (diversity < 3) {
    warnings.push('API key should include uppercase, lowercase, numbers, and special characters');
  }

  // Common patterns check
  if (/^(1234|password|secret|test|demo)/i.test(apiKey)) {
    warnings.push('API key appears to contain common/weak patterns');
  }

  return warnings;
}

/**
 * Generate a secure random API key
 * @param length - Key length (default: 32)
 * @returns Randomly generated API key
 */
export function generateApiKey(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const randomBytes = crypto.getRandomValues(new Uint8Array(length));

  let key = '';
  for (let i = 0; i < length; i++) {
    key += chars[randomBytes[i]! % chars.length];
  }

  return key;
}
