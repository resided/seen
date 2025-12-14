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

    const now = Date.now();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const key = type === 'click' ? CLICKS_KEY : VIEWS_KEY;
    const projectKey = `${key}:${projectId}:${today}`;

    // Increment counter for today
    await redis.incr(projectKey);
    
    // Set expiration to 2 days (to be safe)
    await redis.expire(projectKey, 2 * 24 * 60 * 60);

    // Also track unique clicks/views (using IP or FID if available)
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                     req.headers['x-real-ip'] || 
                     req.socket?.remoteAddress || 
                     'unknown';
    
    if (type === 'click') {
      // Track unique clicks per IP per day
      const uniqueKey = `clicks:unique:${projectId}:${today}:${clientIP}`;
      const exists = await redis.exists(uniqueKey);
      if (!exists) {
        await redis.setEx(uniqueKey, 2 * 24 * 60 * 60, '1');
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
