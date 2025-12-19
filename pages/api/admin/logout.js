// API route for admin logout
// Deletes session from Redis and clears cookie

import { serialize } from 'cookie';
import { deleteSession, getSessionToken } from '../../../lib/admin-auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get session token from cookie
    const sessionToken = getSessionToken(req);

    // Delete session from Redis
    if (sessionToken) {
      await deleteSession(sessionToken);
    }

    // Clear the session cookie
    const cookie = serialize('admin_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0, // Expire immediately
      path: '/',
    });

    res.setHeader('Set-Cookie', cookie);

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('[ADMIN LOGOUT] Error:', error);
    // Still clear cookie even if Redis fails
    const cookie = serialize('admin_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    });
    res.setHeader('Set-Cookie', cookie);

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  }
}
