// API route to update an existing project (admin only)
import { updateProject } from '../../../lib/projects';
import { fetchUserByFid } from '../../../lib/neynar';
import { parse } from 'cookie';
import { checkRateLimit, getClientIP } from '../../../lib/rate-limit';
import { getRedisClient } from '../../../lib/redis';

const ADMIN_FID = 342433; // Admin FID
const RATE_LIMIT_REQUESTS = 20; // Max 20 update actions
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
      tokenName,
      tokenContractAddress,
      category,
      status,
      miniapp,
      website,
      github,
      twitter,
      stats,
      featuredAt,
    } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // Build update data object (only include fields that are provided)
    const updateData = {};
    
    if (name !== undefined) updateData.name = name;
    if (tagline !== undefined) updateData.tagline = tagline;
    if (description !== undefined) updateData.description = description;
    if (tokenName !== undefined) updateData.tokenName = tokenName;
    // Allow empty strings to clear tokenContractAddress, but only update if explicitly provided
    if (tokenContractAddress !== undefined) {
      updateData.tokenContractAddress = tokenContractAddress.trim() || '';
    }
    if (category !== undefined) updateData.category = category;
    if (status !== undefined) updateData.status = status;
    if (stats !== undefined) updateData.stats = stats;
    if (featuredAt !== undefined) updateData.featuredAt = featuredAt;
    
    // Handle builder and builderFid - auto-populate from FID if FID provided but builder not
    let finalBuilder = builder;
    let finalBuilderFid = builderFid !== undefined ? (builderFid ? parseInt(builderFid) : 0) : undefined;
    let finalBuilderUsername = null;
    
    if (finalBuilderFid !== undefined && finalBuilderFid > 0) {
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
    
    if (builder !== undefined) updateData.builder = finalBuilder || builder;
    if (finalBuilderUsername) updateData.builderUsername = finalBuilderUsername;
    if (builderFid !== undefined) updateData.builderFid = finalBuilderFid !== undefined ? finalBuilderFid : (builderFid ? parseInt(builderFid) : 0);

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

    // If stats were updated, also sync Redis window counters for real-time display
    // This sets the base value so future increments continue from the manually set number
    if (stats !== undefined && stats.clicks !== undefined) {
      try {
        const redis = await getRedisClient();
        if (redis) {
          // Get the project BEFORE updating to see current stored stats and featuredAt
          const { getProjectById } = await import('../../../lib/projects');
          const currentProject = await getProjectById(parseInt(projectId));
          const currentStoredTotal = currentProject?.stats?.clicks || 0;
          const newTotal = stats.clicks;
          
          // Use window key based on rotationId for featured projects (stable across timer changes)
          let windowKey;
          if (currentProject?.status === 'featured' && currentProject?.rotationId) {
            windowKey = currentProject.rotationId;
          } else {
            windowKey = new Date().toISOString().split('T')[0];
          }
          
          const clicksKey = `clicks:project:${projectId}:${windowKey}`;
          
          // Get current window counter (if any)
          const currentWindowCount = parseInt(await redis.get(clicksKey) || '0');
          
          // When manually setting stats in admin, set the window counter to the exact value entered
          // This ensures the displayed number matches what the admin set
          // Future clicks/views will increment from this base value
          await redis.set(clicksKey, newTotal.toString());
          
          // Set expiration: 48 hours for featured (to cover full 24h window + buffer), 2 days for others
          const expiration = currentProject?.status === 'featured' ? 48 * 60 * 60 : 2 * 24 * 60 * 60;
          await redis.expire(clicksKey, expiration);
          
          console.log(`Updated clicks: stored=${currentStoredTotal}→${newTotal}, window counter=${currentWindowCount}→${newTotal}, windowKey=${windowKey}`);
        }
      } catch (redisError) {
        console.error('Error syncing Redis window counter:', redisError);
        // Don't fail the update if Redis sync fails
      }
    }

    if (stats !== undefined && stats.views !== undefined) {
      try {
        const redis = await getRedisClient();
        if (redis) {
          // Get the project BEFORE updating to see current stored stats and featuredAt
          const { getProjectById } = await import('../../../lib/projects');
          const currentProject = await getProjectById(parseInt(projectId));
          const currentStoredTotal = currentProject?.stats?.views || 0;
          const newTotal = stats.views;
          
          // Use window key based on rotationId for featured projects (stable across timer changes)
          let windowKey;
          if (currentProject?.status === 'featured' && currentProject?.rotationId) {
            windowKey = currentProject.rotationId;
          } else {
            windowKey = new Date().toISOString().split('T')[0];
          }
          
          const viewsKey = `views:project:${projectId}:${windowKey}`;
          
          // Get current window counter (if any)
          const currentWindowCount = parseInt(await redis.get(viewsKey) || '0');
          
          // When manually setting stats in admin, set the window counter to the exact value entered
          // This ensures the displayed number matches what the admin set
          // Future clicks/views will increment from this base value
          await redis.set(viewsKey, newTotal.toString());
          
          // Set expiration: 48 hours for featured (to cover full 24h window + buffer), 2 days for others
          const expiration = currentProject?.status === 'featured' ? 48 * 60 * 60 : 2 * 24 * 60 * 60;
          await redis.expire(viewsKey, expiration);
          
          console.log(`Updated views: stored=${currentStoredTotal}→${newTotal}, window counter=${currentWindowCount}→${newTotal}, windowKey=${windowKey}`);
        }
      } catch (redisError) {
        console.error('Error syncing Redis window counter:', redisError);
        // Don't fail the update if Redis sync fails
      }
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
