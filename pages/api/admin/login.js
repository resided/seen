// API route for admin login
// Implements secure session management with Redis validation

import { serialize } from 'cookie';
import { checkRateLimit, getClientIP } from '../../../lib/rate-limit';
import { createSession } from '../../../lib/admin-auth';

// NO DEFAULTS - require environment variables to be set
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const RATE_LIMIT_REQUESTS = 5; // Max 5 login attempts
const RATE_LIMIT_WINDOW = 300000; // Per 5 minutes (to prevent brute force)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting for login attempts (prevent brute force)
  const clientIP = getClientIP(req);
  const rateLimit = await checkRateLimit(`admin:login:${clientIP}`, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW);
  
  if (!rateLimit.allowed) {
    return res.status(429).json({ 
      error: 'Too many login attempts. Please try again later.',
      retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
    });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // Validate environment variables are set
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.error('[ADMIN LOGIN] ADMIN_USERNAME or ADMIN_PASSWORD not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Check credentials
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    try {
      // Create session in Redis and get token
      const token = await createSession(username, clientIP);

      // Set secure cookie with session token
      const cookie = serialize('admin_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24, // 24 hours (matches Redis expiry)
        path: '/',
      });

      res.setHeader('Set-Cookie', cookie);

      return res.status(200).json({
        success: true,
        message: 'Login successful',
      });
    } catch (error) {
      console.error('[ADMIN LOGIN] Session creation failed:', error);
      return res.status(500).json({ error: 'Failed to create session' });
    }
  } else {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
}
