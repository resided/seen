// Simple stats API for the simplified claim system
import { getRedisClient } from '../../../lib/redis';
import { getFeaturedProject } from '../../../lib/projects';

const CLAIMS_DISABLED_KEY = 'config:claims:disabled';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const redis = await getRedisClient();
    if (!redis) {
      return res.status(500).json({ error: 'Redis not available' });
    }

    // Check if claims are disabled
    const disabledValue = await redis.get(CLAIMS_DISABLED_KEY);
    const disabled = disabledValue === 'true';

    const featuredProject = await getFeaturedProject();
    if (!featuredProject || !featuredProject.id) {
      return res.status(200).json({
        totalClaims: 0,
        uniqueWallets: 0,
        featuredProject: null,
        disabled,
      });
    }

    const featuredProjectId = featuredProject.id;
    const pattern = `simple:claim:${featuredProjectId}:*`;

    // Count claims and unique wallets
    const wallets = new Set();
    let totalClaims = 0;

    for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      // Skip lock keys
      if (key.includes(':lock:')) continue;
      
      totalClaims++;
      const walletAddress = await redis.get(key);
      if (walletAddress) {
        wallets.add(walletAddress.toLowerCase());
      }
    }

    return res.status(200).json({
      totalClaims,
      uniqueWallets: wallets.size,
      featuredProject: {
        id: featuredProjectId,
        name: featuredProject.name || 'Unknown',
      },
      disabled,
    });

  } catch (error) {
    console.error('Error fetching simple stats:', error);
    return res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
  }
}

