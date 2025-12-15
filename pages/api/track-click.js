// API route to track clicks on mini app opens
import { getRedisClient } from '../../lib/redis';

const CLICKS_KEY = 'clicks:project'; // Track clicks per project
const VIEWS_KEY = 'views:project'; // Track views per project

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { projectId, type } = req.body; // type: 'click' or 'view'

    if (!projectId || !type) {
      return res.status(400).json({ error: 'Missing projectId or type' });
    }

    const redis = await getRedisClient();
    if (!redis) {
      // If Redis unavailable, still return success (fail gracefully)
      return res.status(200).json({ success: true, tracked: false });
    }

    // Get project to check if it's featured and has featuredAt
    const { getProjectById } = await import('../../lib/projects');
    const project = await getProjectById(parseInt(projectId));
    
    // For featured projects, use 24-hour window from featuredAt instead of calendar date
    let windowKey;
    if (project?.status === 'featured' && project?.featuredAt) {
      const featuredDate = new Date(project.featuredAt);
      const windowStart = Math.floor(featuredDate.getTime() / 1000);
      windowKey = windowStart.toString();
    } else {
      // For non-featured projects, use calendar date (backward compatibility)
      windowKey = new Date().toISOString().split('T')[0];
    }
    
    const key = type === 'click' ? CLICKS_KEY : VIEWS_KEY;
    const projectKey = `${key}:${projectId}:${windowKey}`;

    // Increment counter
    await redis.incr(projectKey);
    
    // Set expiration: 48 hours for featured (to cover full 24h window + buffer), 2 days for others
    const expiration = project?.status === 'featured' ? 48 * 60 * 60 : 2 * 24 * 60 * 60;
    await redis.expire(projectKey, expiration);

    // Also track unique clicks/views (using IP or FID if available)
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                     req.headers['x-real-ip'] || 
                     req.socket?.remoteAddress || 
                     'unknown';
    
    if (type === 'click') {
      // Track unique clicks per IP per window
      const uniqueKey = `clicks:unique:${projectId}:${windowKey}:${clientIP}`;
      const exists = await redis.exists(uniqueKey);
      if (!exists) {
        const expiration = project?.status === 'featured' ? 48 * 60 * 60 : 2 * 24 * 60 * 60;
        await redis.setEx(uniqueKey, expiration, '1');
      }
    }

    return res.status(200).json({ 
      success: true, 
      tracked: true,
      type,
      projectId 
    });
  } catch (error) {
    console.error('Error tracking click/view:', error);
    // Fail gracefully - don't break the user experience
    return res.status(200).json({ success: true, tracked: false });
  }
}
