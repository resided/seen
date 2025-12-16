// API route to get claim statistics (admin only)
import { getRedisClient } from '../../../lib/redis';
import { getFeaturedProject } from '../../../lib/projects';
import { parse } from 'cookie';

const ADMIN_FID = 342433;

function isAuthenticated(req) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return false;
  }
  
  const providedSecret = req.headers['x-admin-secret'] || req.body?.adminSecret;
  if (providedSecret && providedSecret === adminSecret) {
    return true;
  }

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

  if (!isAuthenticated(req)) {
    return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
  }

  try {
    const redis = await getRedisClient();
    if (!redis) {
      return res.status(500).json({ error: 'Redis not available' });
    }

    const featuredProject = await getFeaturedProject();
    if (!featuredProject) {
      return res.status(200).json({
        totalClaims: 0,
        uniqueWallets: 0,
        holderClaims: 0,
        featuredProject: null,
      });
    }

    const featuredProjectId = featuredProject.id;
    const featuredAt = featuredProject.featuredAt ? new Date(featuredProject.featuredAt) : new Date();
    const featuredAtTimestamp = Math.floor(featuredAt.getTime() / 1000);

    // Count total claims for this rotation
    const claimPattern = `claim:featured:${featuredProjectId}:${featuredAtTimestamp}:*`;
    const claimKeys = [];
    let cursor = 0; // Start with 0
    do {
      const result = await redis.scan(cursor, {
        MATCH: claimPattern,
        COUNT: 100
      });
      // node-redis v4+ returns { cursor: number, keys: string[] }
      cursor = result.cursor;
      if (result.keys && result.keys.length > 0) {
        claimKeys.push(...result.keys);
      }
    } while (cursor !== 0);

    // Count unique wallets
    const walletPattern = `claim:wallet:${featuredProjectId}:${featuredAtTimestamp}:*`;
    const walletKeys = [];
    cursor = 0; // Start with 0
    do {
      const result = await redis.scan(cursor, {
        MATCH: walletPattern,
        COUNT: 100
      });
      // node-redis v4+ returns { cursor: number, keys: string[] }
      cursor = result.cursor;
      if (result.keys && result.keys.length > 0) {
        walletKeys.push(...result.keys);
      }
    } while (cursor !== 0);

    // Count holder claims (claims > 1 per wallet)
    let holderClaims = 0;
    for (const key of walletKeys) {
      const count = parseInt(await redis.get(key) || '0');
      if (count > 1) {
        holderClaims += count - 1; // Additional claims beyond first
      }
    }

    return res.status(200).json({
      totalClaims: claimKeys.length,
      uniqueWallets: walletKeys.length,
      holderClaims,
      featuredProject: {
        id: featuredProject.id,
        name: featuredProject.name,
        featuredAt: featuredProject.featuredAt,
      },
    });
  } catch (error) {
    console.error('Error fetching claim stats:', error);
    return res.status(500).json({ error: 'Failed to fetch claim stats', details: error.message });
  }
}

