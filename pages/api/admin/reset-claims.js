// API route to reset claims for current featured project (admin only)
import { getRedisClient } from '../../../lib/redis';
import { getFeaturedProject } from '../../../lib/projects';
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

  try {
    const { confirm } = req.body;
    
    if (confirm !== 'RESET') {
      return res.status(400).json({ 
        error: 'Must confirm with confirm: "RESET" to reset all claims for today' 
      });
    }

    const redis = await getRedisClient();
    if (!redis) {
      return res.status(500).json({ error: 'Redis not available' });
    }

    // Get current featured project
    const featuredProject = await getFeaturedProject();
    if (!featuredProject || !featuredProject.id) {
      return res.status(400).json({ error: 'No featured project found' });
    }

    const featuredProjectId = featuredProject.id;
    const featuredAt = featuredProject.featuredAt ? new Date(featuredProject.featuredAt) : new Date();
    const featuredAtTimestamp = Math.floor(featuredAt.getTime() / 1000);
    
    // Find all claim keys for this specific featured rotation
    // Pattern includes featuredAt timestamp to only reset current rotation
    const pattern = `claim:featured:${featuredProjectId}:${featuredAtTimestamp}:*`;
    const keys = [];
    
    // Redis SCAN to find all matching keys
    let cursor = 0;
    do {
      const result = await redis.scan(cursor, {
        MATCH: pattern,
        COUNT: 100
      });
      cursor = result.cursor;
      keys.push(...result.keys);
    } while (cursor !== 0);

    // Also find transaction hash keys for this specific featured rotation
    const txPattern = `claim:tx:${featuredProjectId}:${featuredAtTimestamp}:*`;
    const txKeys = [];
    cursor = 0;
    do {
      const result = await redis.scan(cursor, {
        MATCH: txPattern,
        COUNT: 100
      });
      cursor = result.cursor;
      txKeys.push(...result.keys);
    } while (cursor !== 0);

    // Delete all claim keys for this featured project
    if (keys.length > 0) {
      await redis.del(keys);
    }
    
    if (txKeys.length > 0) {
      await redis.del(txKeys);
    }

    return res.status(200).json({
      success: true,
      message: `Reset ${keys.length} claim(s) and ${txKeys.length} transaction(s) for featured project ${featuredProjectId} (rotation started at ${featuredAt.toISOString()})`,
      claimsReset: keys.length,
      transactionsReset: txKeys.length,
      featuredProjectId,
      featuredProjectName: featuredProject.name,
      featuredAt: featuredAt.toISOString(),
    });
  } catch (error) {
    console.error('Error resetting claims:', error);
    return res.status(500).json({ error: 'Failed to reset claims' });
  }
}
