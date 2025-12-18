// Simple stats API for the simplified claim system
import { getRedisClient } from '../../../lib/redis';
import { getFeaturedProject } from '../../../lib/projects';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const redis = await getRedisClient();
    if (!redis) {
      return res.status(500).json({ error: 'Redis not available' });
    }

    const featuredProject = await getFeaturedProject();
    if (!featuredProject || !featuredProject.id) {
      return res.status(200).json({
        totalClaims: 0,
        uniqueWallets: 0,
        featuredProject: null,
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
    });

  } catch (error) {
    console.error('Error fetching simple stats:', error);
    return res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
  }
}

