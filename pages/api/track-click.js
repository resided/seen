// API route to track clicks on mini app opens
import { getRedisClient } from '../../lib/redis';

const CLICKS_KEY = 'clicks:project'; // Track clicks per project
const VIEWS_KEY = 'views:project'; // Track views per project

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting: 100 requests per IP per minute
  const { checkRateLimit, getClientIP } = await import('../../lib/rate-limit');
  const clientIP = getClientIP(req);
  const rateLimit = await checkRateLimit(`track:${clientIP}`, 100, 60000);
  if (!rateLimit.allowed) {
    return res.status(429).json({ 
      error: 'Too many requests. Please slow down.',
      retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
    });
  }

  try {
    const { projectId, type } = req.body; // type: 'click' or 'view'

    // Validate inputs - be more lenient with projectId
    if (projectId === undefined || projectId === null || projectId === '') {
      console.warn('Track-click validation failed: missing projectId', { projectId, type, body: req.body });
      // Fail silently for missing projectId - don't break user experience
      return res.status(200).json({ success: true, tracked: false, reason: 'Missing projectId' });
    }

    if (!type || (type !== 'click' && type !== 'view')) {
      console.warn('Track-click validation failed: invalid type', { projectId, type, body: req.body });
      // Fail silently for invalid type - don't break user experience
      return res.status(200).json({ success: true, tracked: false, reason: 'Invalid type' });
    }

    // Validate projectId is a positive integer - handle both string and number
    // Note: projectId can be large (timestamp-based IDs), so don't limit to 32-bit int
    const projectIdNum = typeof projectId === 'number' ? projectId : parseInt(String(projectId), 10);
    if (isNaN(projectIdNum) || projectIdNum <= 0) {
      console.warn('Track-click validation failed: invalid projectId format', { projectId, projectIdNum, type: typeof projectId, body: req.body });
      // Fail silently for invalid projectId - don't break user experience
      return res.status(200).json({ success: true, tracked: false, reason: 'Invalid projectId format' });
    }

    const redis = await getRedisClient();
    if (!redis) {
      // If Redis unavailable, still return success (fail gracefully)
      return res.status(200).json({ success: true, tracked: false });
    }

    // Get project to check if it's featured and has rotationId
    const { getProjectById, updateProjectStats } = await import('../../lib/projects');
    const project = await getProjectById(projectIdNum);
    
    // For featured projects, use rotationId as the window key (stable across timer changes)
    // For non-featured projects, update persistent stats directly
    if (project?.status === 'featured' && project?.rotationId) {
      const windowKey = project.rotationId;
    const key = type === 'click' ? CLICKS_KEY : VIEWS_KEY;
    const projectKey = `${key}:${projectIdNum}:${windowKey}`;

    // Increment counter
    await redis.incr(projectKey);
    
      // Set expiration: 48 hours for featured (to cover full 24h window + buffer)
      await redis.expire(projectKey, 48 * 60 * 60);
    } else {
      // Non-featured projects: update persistent stats directly so they accumulate forever
      const statField = type === 'click' ? 'clicks' : 'views';
      const currentValue = project?.stats?.[statField] || 0;
      await updateProjectStats(projectIdNum, { [statField]: currentValue + 1 });
    }

    // Also track unique clicks/views (using IP or FID if available)
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                     req.headers['x-real-ip'] || 
                     req.socket?.remoteAddress || 
                     'unknown';
    
    if (type === 'click') {
      // Track unique clicks per IP (use rotationId for featured, permanent key for non-featured)
      const uniqueWindowKey = project?.status === 'featured' && project?.rotationId 
        ? project.rotationId 
        : 'permanent';
      const uniqueKey = `clicks:unique:${projectIdNum}:${uniqueWindowKey}:${clientIP}`;
      const exists = await redis.exists(uniqueKey);
      if (!exists) {
        // Featured: expire after 48h, Non-featured: expire after 30 days
        const expiration = project?.status === 'featured' ? 48 * 60 * 60 : 30 * 24 * 60 * 60;
        await redis.setEx(uniqueKey, expiration, '1');
      }
    }

    return res.status(200).json({ 
      success: true, 
      tracked: true,
      type,
      projectId: projectIdNum
    });
  } catch (error) {
    console.error('Error tracking click/view:', error);
    // Fail gracefully - don't break the user experience
    return res.status(200).json({ success: true, tracked: false });
  }
}
