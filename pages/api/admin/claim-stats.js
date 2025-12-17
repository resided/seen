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

    // Helper function to scan Redis keys with v5 compatibility
    const scanKeys = async (pattern) => {
      const foundKeys = [];
      try {
        // Try scanIterator first (node-redis v5)
        for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
          foundKeys.push(key);
        }
      } catch (err) {
        // Fallback to manual scan
        let cursor = '0';
        do {
          const result = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
          cursor = String(result.cursor ?? result[0] ?? '0');
          const keys = result.keys || result[1] || [];
          if (keys.length > 0) foundKeys.push(...keys);
        } while (cursor !== '0');
      }
      return foundKeys;
    };

    // Use rotationId instead of featuredAtTimestamp for consistency with other APIs
    const rotationId = featuredProject.rotationId || `legacy_${featuredProjectId}`;

    // Count total claims for this rotation
    const claimPattern = `claim:featured:${featuredProjectId}:${rotationId}:*`;
    const claimKeys = await scanKeys(claimPattern);

    // Count unique wallets (global wallet counts per rotation)
    // CRITICAL: Key format must match claim/index.js: claim:wallet:global:${projectId}:${rotationId}:${wallet}
    const walletPattern = `claim:wallet:global:${featuredProjectId}:${rotationId}:*`;
    const walletKeys = await scanKeys(walletPattern);

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

