// API route to approve or reject submissions (admin only)
import { approveProject, rejectProject, approveAndFeatureProject, scheduleFeaturedProject } from '../../../lib/projects'
import { parse } from 'cookie';
import { checkRateLimit, getClientIP } from '../../../lib/rate-limit';

const ADMIN_FID = 342433; // Admin FID
const RATE_LIMIT_REQUESTS = 20; // Max 20 approve/reject actions
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
  const rateLimit = await checkRateLimit(`admin:approve:${clientIP}`, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW);
  
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

  const { projectId, action, scheduledDate } = req.body;

  try {
    console.log('Approve API called:', { projectId, action, type: typeof projectId, scheduledDate });

    if (!projectId || !action) {
      return res.status(400).json({ error: 'Missing projectId or action' })
    }

    if (action === 'approve') {
      const project = await approveProject(projectId)
      if (!project) {
        return res.status(404).json({ error: 'Project not found' })
      }
      res.status(200).json({
        success: true,
        message: 'Project approved and added to queue',
        project
      })
    } else if (action === 'feature') {
      // Approve and immediately feature the project
      const project = await approveAndFeatureProject(projectId)
      if (!project) {
        return res.status(404).json({ error: 'Project not found' })
      }
      res.status(200).json({
        success: true,
        message: 'Project approved and featured immediately',
        project
      })
    } else if (action === 'schedule') {
      // Schedule project to be featured at a specific date/time
      if (!scheduledDate) {
        return res.status(400).json({ error: 'Missing scheduledDate for schedule action' })
      }
      
      const project = await scheduleFeaturedProject(projectId, scheduledDate)
      if (!project) {
        return res.status(404).json({ error: 'Project not found' })
      }
      
      // Display in UK timezone for confirmation
      const displayDate = new Date(scheduledDate).toLocaleString('en-GB', { 
        timeZone: 'Europe/London',
        dateStyle: 'long',
        timeStyle: 'short'
      });
      
      res.status(200).json({
        success: true,
        message: `Project scheduled to be featured on ${displayDate} (UK time)`,
        project
      })
    } else if (action === 'reject') {
      const project = await rejectProject(projectId)
      if (!project) {
        return res.status(404).json({ error: 'Project not found' })
      }
      res.status(200).json({
        success: true,
        message: 'Project rejected',
        project
      })
    } else {
      return res.status(400).json({ error: 'Invalid action. Use "approve", "feature", "schedule", or "reject"' })
    }
  } catch (error) {
    console.error('Error processing submission:', error)
    res.status(500).json({ error: 'Failed to process submission' })
  }
}
