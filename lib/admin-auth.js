// Centralized admin authentication utilities
// Implements secure session management with Redis validation

import { randomBytes } from 'crypto';
import { parse } from 'cookie';
import { getRedisClient } from './redis';

const SESSION_PREFIX = 'admin:session:';
const SESSION_EXPIRY = 24 * 60 * 60; // 24 hours in seconds

// Validate required environment variables on module load
function validateEnvVars() {
  const required = ['ADMIN_SECRET', 'ADMIN_USERNAME', 'ADMIN_PASSWORD'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(`[ADMIN AUTH] Missing required environment variables: ${missing.join(', ')}`);
    console.error('[ADMIN AUTH] Admin endpoints will be disabled until these are set.');
    return false;
  }

  // Validate password strength
  const password = process.env.ADMIN_PASSWORD;
  if (password.length < 12) {
    console.warn('[ADMIN AUTH] ADMIN_PASSWORD should be at least 12 characters for security');
  }

  return true;
}

const ENV_VALID = validateEnvVars();

/**
 * Generate a secure random session token
 */
export function generateSessionToken() {
  return randomBytes(32).toString('base64');
}

/**
 * Create a new admin session in Redis
 * @param {string} username - Admin username
 * @param {string} ip - Client IP address
 * @returns {Promise<string>} Session token
 */
export async function createSession(username, ip) {
  const redis = await getRedisClient();
  if (!redis) {
    throw new Error('Redis unavailable - cannot create session');
  }

  const token = generateSessionToken();
  const sessionData = {
    username,
    ip,
    createdAt: Date.now(),
  };

  await redis.set(
    `${SESSION_PREFIX}${token}`,
    JSON.stringify(sessionData),
    { EX: SESSION_EXPIRY }
  );

  console.log('[ADMIN AUTH] Session created:', { username, ip, expiresIn: SESSION_EXPIRY });
  return token;
}

/**
 * Validate a session token against Redis
 * @param {string} token - Session token from cookie
 * @returns {Promise<Object|null>} Session data if valid, null otherwise
 */
export async function validateSession(token) {
  if (!token) return null;

  const redis = await getRedisClient();
  if (!redis) {
    console.error('[ADMIN AUTH] Redis unavailable - cannot validate session');
    return null;
  }

  try {
    const sessionData = await redis.get(`${SESSION_PREFIX}${token}`);
    if (!sessionData) {
      return null;
    }

    const session = JSON.parse(sessionData);

    // Check if session is older than 12 hours - require re-login for security
    const sessionAge = Date.now() - session.createdAt;
    const maxAge = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

    if (sessionAge > maxAge) {
      console.log('[ADMIN AUTH] Session expired (>12h old), deleting');
      await deleteSession(token);
      return null;
    }

    return session;
  } catch (error) {
    console.error('[ADMIN AUTH] Error validating session:', error);
    return null;
  }
}

/**
 * Delete a session from Redis (logout)
 * @param {string} token - Session token to delete
 */
export async function deleteSession(token) {
  if (!token) return;

  const redis = await getRedisClient();
  if (!redis) {
    console.error('[ADMIN AUTH] Redis unavailable - cannot delete session');
    return;
  }

  await redis.del(`${SESSION_PREFIX}${token}`);
  console.log('[ADMIN AUTH] Session deleted');
}

/**
 * Check if request is authenticated via session cookie or ADMIN_SECRET header
 * @param {Object} req - Next.js request object
 * @returns {Promise<boolean>} True if authenticated
 */
export async function isAuthenticated(req) {
  if (!ENV_VALID) {
    return false;
  }

  // Method 1: Check for ADMIN_SECRET in header or body
  const adminSecret = process.env.ADMIN_SECRET;
  const providedSecret = req.headers['x-admin-secret'] || req.body?.adminSecret;

  if (providedSecret && providedSecret === adminSecret) {
    return true;
  }

  // Method 2: Validate session cookie against Redis
  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.admin_session;

  if (sessionToken) {
    const session = await validateSession(sessionToken);
    if (session) {
      return true;
    }
  }

  return false;
}

/**
 * Get session token from request cookies
 * @param {Object} req - Next.js request object
 * @returns {string|null} Session token if present
 */
export function getSessionToken(req) {
  const cookies = parse(req.headers.cookie || '');
  return cookies.admin_session || null;
}
