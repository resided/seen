// API route to get pending submissions (admin only)
import { getPendingSubmissions } from '../../../lib/projects'
import { parse } from 'cookie';

const ADMIN_FID = 342433; // Admin FID

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

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Check admin authentication
  if (!isAuthenticated(req)) {
    return res.status(403).json({ error: 'Unauthorized. Admin access required.' })
  }

  try {
    const submissions = getPendingSubmissions()
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
