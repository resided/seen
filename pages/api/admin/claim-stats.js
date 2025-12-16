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
    // Use EXACT same pattern as reset-claims.js which works
    const claimPattern = `claim:featured:${featuredProjectId}:${featuredAtTimestamp}:*`;
    const claimKeys = [];
    let cursor = 0;
    try {
      do {
        const result = await redis.scan(cursor, {
          MATCH: claimPattern,
          COUNT: 100
        });
        // Handle both array [cursor, keys] and object {cursor, keys} return types
        const nextCursor = Array.isArray(result) ? result[0] : (result?.cursor || result?.nextCursor);
        const foundKeys = Array.isArray(result) ? result[1] : (result?.keys || []);
        cursor = typeof nextCursor === 'string' ? parseInt(nextCursor, 10) : nextCursor;
        if (foundKeys && Array.isArray(foundKeys) && foundKeys.length > 0) {
          claimKeys.push(...foundKeys);
        }
      } while (cursor !== 0);
    } catch (scanError) {
      console.error('Error scanning for claim keys:', scanError);
      throw new Error(`Failed to scan for claim keys: ${scanError.message}`);
    }

    // Count unique wallets
    const walletPattern = `claim:wallet:${featuredProjectId}:${featuredAtTimestamp}:*`;
    const walletKeys = [];
    cursor = 0;
    try {
      do {
        const result = await redis.scan(cursor, {
          MATCH: walletPattern,
          COUNT: 100
        });
        // Handle both array [cursor, keys] and object {cursor, keys} return types
        const nextCursor = Array.isArray(result) ? result[0] : (result?.cursor || result?.nextCursor);
        const foundKeys = Array.isArray(result) ? result[1] : (result?.keys || []);
        cursor = typeof nextCursor === 'string' ? parseInt(nextCursor, 10) : nextCursor;
        if (foundKeys && Array.isArray(foundKeys) && foundKeys.length > 0) {
          walletKeys.push(...foundKeys);
        }
      } while (cursor !== 0);
    } catch (scanError) {
      console.error('Error scanning for wallet keys:', scanError);
      throw new Error(`Failed to scan for wallet keys: ${scanError.message}`);
    }

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

