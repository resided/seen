// API route to create a project directly (admin only)
import { createProjectDirectly } from '../../../lib/projects';
import { parse } from 'cookie';
import { checkRateLimit, getClientIP } from '../../../lib/rate-limit';

const ADMIN_FID = 342433; // Admin FID
const RATE_LIMIT_REQUESTS = 10; // Max 10 create actions
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
    return true;
  }

  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check admin authentication
  if (!isAuthenticated(req)) {
    return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
  }

  // Rate limiting
  const clientIP = getClientIP(req);
  const rateLimit = await checkRateLimit(`admin:create:${clientIP}`, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW);
  
  if (!rateLimit.allowed) {
    return res.status(429).json({ 
      error: 'Too many requests. Please slow down.',
      retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
    });
  }

  try {
    const {
      name,
      tagline,
      description,
      builder,
      builderFid,
      category,
      miniapp,
      website,
      github,
      twitter,
      setAsFeatured,
      stats,
    } = req.body;

    // Validate required fields
    if (!name || !tagline || !description || !builder || !category) {
      return res.status(400).json({ error: 'Missing required fields: name, tagline, description, builder, category' });
    }

    // Create project directly
    const project = await createProjectDirectly(
      {
        name,
        tagline,
        description,
        builder,
        builderFid: builderFid || 0,
        category,
        links: {
          miniapp: miniapp || '',
          website: website || '',
          github: github || '',
          twitter: twitter || null,
        },
        stats: stats || {
          views: 0,
          clicks: 0,
          tips: 0,
        },
      },
      setAsFeatured === true
    );

    return res.status(201).json({
      success: true,
      message: setAsFeatured 
        ? 'Project created and featured immediately!' 
        : 'Project created and added to queue!',
      project,
    });
  } catch (error) {
    console.error('Error creating project:', error);
    return res.status(500).json({ error: 'Failed to create project' });
  }
}
