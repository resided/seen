// API route to update an existing project (admin only)
import { updateProject } from '../../../lib/projects';
import { parse } from 'cookie';
import { checkRateLimit, getClientIP } from '../../../lib/rate-limit';

const ADMIN_FID = 342433; // Admin FID
const RATE_LIMIT_REQUESTS = 20; // Max 20 update actions
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
  const rateLimit = await checkRateLimit(`admin:update:${clientIP}`, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW);
  
  if (!rateLimit.allowed) {
    return res.status(429).json({ 
      error: 'Too many requests. Please slow down.',
      retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
    });
  }

  try {
    const {
      projectId,
      name,
      tagline,
      description,
      builder,
      builderFid,
      category,
      status,
      miniapp,
      website,
      github,
      twitter,
      stats,
    } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // Build update data object (only include fields that are provided)
    const updateData = {};
    
    if (name !== undefined) updateData.name = name;
    if (tagline !== undefined) updateData.tagline = tagline;
    if (description !== undefined) updateData.description = description;
    if (builder !== undefined) updateData.builder = builder;
    if (builderFid !== undefined) updateData.builderFid = builderFid;
    if (category !== undefined) updateData.category = category;
    if (status !== undefined) updateData.status = status;
    if (stats !== undefined) updateData.stats = stats;

    // Update links if any are provided
    if (miniapp !== undefined || website !== undefined || github !== undefined || twitter !== undefined) {
      updateData.links = {};
      if (miniapp !== undefined) updateData.links.miniapp = miniapp;
      if (website !== undefined) updateData.links.website = website;
      if (github !== undefined) updateData.links.github = github;
      if (twitter !== undefined) updateData.links.twitter = twitter;
    }

    // Update project
    const updatedProject = await updateProject(parseInt(projectId), updateData);

    if (!updatedProject) {
      return res.status(404).json({ error: 'Project not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Project updated successfully!',
      project: updatedProject,
    });
  } catch (error) {
    console.error('Error updating project:', error);
    return res.status(500).json({ error: 'Failed to update project' });
  }
}
