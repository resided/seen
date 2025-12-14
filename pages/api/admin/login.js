// API route for admin login
import { serialize } from 'cookie';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123'; // Change this!
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-secret-key-change-this';

// Simple session token generation (in production, use a proper JWT library)
function generateToken() {
  return Buffer.from(`${Date.now()}-${Math.random()}`).toString('base64');
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // Check credentials
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    // Generate session token
    const token = generateToken();
    
    // Set cookie with session token
    const cookie = serialize('admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    res.setHeader('Set-Cookie', cookie);
    
    return res.status(200).json({
      success: true,
      message: 'Login successful',
    });
  } else {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
}
