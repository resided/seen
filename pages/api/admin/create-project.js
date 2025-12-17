// API route to create a project directly (admin only)
import { createProjectDirectly } from '../../../lib/projects';
import { fetchUserByFid } from '../../../lib/neynar';
import { parse } from 'cookie';
import { checkRateLimit, getClientIP } from '../../../lib/rate-limit';

const ADMIN_FID = 342433; // Admin FID
const RATE_LIMIT_REQUESTS = 10; // Max 10 create actions
const RATE_LIMIT_WINDOW = 60000; // Per minute

function isAuthenticated(req) {
  // SECURITY: Require ADMIN_SECRET for all admin operations
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    console.error('ADMIN_SECRET not configured - admin endpoints disabled');
    return false;
  }
  
  // Check for secret in header or body
  const providedSecret = req.headers['x-admin-secret'] || req.body?.adminSecret;
  if (providedSecret && providedSecret === adminSecret) {
    return true;
  }

  // Check session cookie (web login) - only if ADMIN_PASSWORD is properly set
  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.admin_session;
  if (sessionToken && process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD !== 'changeme123') {
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
    if (!name || !tagline || !description || !category) {
      return res.status(400).json({ error: 'Missing required fields: name, tagline, description, category' });
    }

    // Auto-populate builder info from FID if FID is provided but builder name is not
    let finalBuilder = builder;
    let finalBuilderFid = builderFid ? parseInt(builderFid) : 0;
    let finalBuilderUsername = null;
    
    if (finalBuilderFid > 0) {
      const apiKey = process.env.NEYNAR_API_KEY;
      if (apiKey) {
        try {
          const user = await fetchUserByFid(finalBuilderFid, apiKey);
          if (user) {
            // Always store the clean username (without emojis)
            finalBuilderUsername = user.username || null;
            // Only auto-populate builder name if it's empty
            if (!finalBuilder || finalBuilder.trim() === '') {
              finalBuilder = user.display_name || user.username || '';
            }
            finalBuilderFid = user.fid || finalBuilderFid;
          }
        } catch (error) {
          console.error('Error fetching user data from FID:', error);
          // Continue without auto-population if fetch fails
        }
      }
    }

    // Builder is required - if still empty after FID lookup, return error
    if (!finalBuilder || finalBuilder.trim() === '') {
      return res.status(400).json({ error: 'Builder name is required. Provide builder name or builderFid to auto-populate.' });
    }

    // Create project directly
    const project = await createProjectDirectly(
      {
        name,
        tagline,
        description,
        builder: finalBuilder,
        builderUsername: finalBuilderUsername,
        builderFid: finalBuilderFid,
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
