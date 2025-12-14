// API route to get pending submissions (admin only)
import { getPendingSubmissions } from '../../../lib/projects'
import { parse } from 'cookie';
import { checkRateLimit, getClientIP } from '../../../lib/rate-limit';

const ADMIN_FID = 342433; // Admin FID
const RATE_LIMIT_REQUESTS = 30; // Max 30 requests
const RATE_LIMIT_WINDOW = 60000; // Per minute

function isAuthenticated(req) {
  // Check FID authentication (Farcaster)
  const { fid } = req.body || {};
  if (fid && parseInt(fid) === ADMIN_FID) {
    return true;
  }

  // Check session cookie (web login)
  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.admin_session;
  if (sessionToken) {
    // In production, verify the token properly
    // For now, just check if it exists
    return true;
  }

  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Check admin authentication
  if (!isAuthenticated(req)) {
    return res.status(403).json({ error: 'Unauthorized. Admin access required.' })
  }

  // Rate limiting - use IP address as identifier
  const clientIP = getClientIP(req);
  const rateLimit = await checkRateLimit(`admin:${clientIP}`, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW);
  
  if (!rateLimit.allowed) {
    return res.status(429).json({ 
      error: 'Too many requests. Please slow down.',
      retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
    });
  }
  
  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimit.resetAt / 1000));

  try {
    const submissions = await getPendingSubmissions()
    // Log for debugging
    console.log(`Admin fetching submissions: ${submissions.length} pending`);
    res.status(200).json({
      submissions,
      count: submissions.length
    })
  } catch (error) {
    console.error('Error fetching pending submissions:', error)
    res.status(500).json({ error: 'Failed to fetch submissions' })
  }
}
