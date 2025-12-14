// API route for admin logout
import { serialize } from 'cookie';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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
}
