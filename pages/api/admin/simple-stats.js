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

    // Use rotationId to match claim key format (simple:claim:${rotationId}:${fid})
    const rotationId = featuredProject.rotationId;
    if (!rotationId) {
      return res.status(200).json({
        totalClaims: 0,
        uniqueWallets: 0,
        featuredProject: { id: featuredProject.id, name: featuredProject.name },
        disabled,
        error: 'No rotation ID found',
      });
    }
    const pattern = `simple:claim:${rotationId}:*`;

    // Count claims and unique wallets
    const wallets = new Set();
    let totalClaims = 0;

    for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      // Skip lock keys and wallet keys
      if (key.includes(':lock:') || key.includes(':wallet:')) continue;
      
      totalClaims++;
      const claimData = await redis.get(key);
      // Old format stored timestamp as string, new format might store JSON
      // The claim key value is just the timestamp string
    }
    
    // Count wallet claims separately (these are the actual recipients)
    const walletPattern = `simple:claim:wallet:${rotationId}:*`;
    let walletClaimCount = 0;
    
    try {
      for await (const key of redis.scanIterator({ MATCH: walletPattern, COUNT: 100 })) {
        walletClaimCount++;
        // Extract wallet from key: simple:claim:wallet:${rotationId}:${wallet}
        const parts = key.split(':');
        if (parts.length >= 5) {
          wallets.add(parts[4].toLowerCase());
        }
      }
    } catch (e) {
      console.warn('[SIMPLE STATS] Error counting wallet claims:', e.message);
    }

    return res.status(200).json({
      totalClaims,
      uniqueWallets: wallets.size,
      walletClaimCount,
      featuredProject: {
        id: featuredProject.id,
        name: featuredProject.name || 'Unknown',
        rotationId,
      },
      disabled,
    });

  } catch (error) {
    console.error('Error fetching simple stats:', error);
    return res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
  }
}

