// SIMPLE RESET - Clears all simple claims for the current featured project
// No complex logic, just delete the keys
// Also handles enabling/disabling claims globally

import { getRedisClient } from '../../../lib/redis';
import { getFeaturedProject } from '../../../lib/projects';
import { isAuthenticated } from '../../../lib/admin-auth';

const ADMIN_FID = 342433;
const CLAIMS_DISABLED_KEY = 'config:claims:disabled';


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await isAuthenticated(req))) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const redis = await getRedisClient();
  if (!redis) {
    return res.status(500).json({ error: 'Redis unavailable' });
  }

  // Handle enable/disable toggle
  const { disable } = req.body;
  if (disable !== undefined && disable !== null) {
    if (disable) {
      await redis.set(CLAIMS_DISABLED_KEY, 'true');
      console.log('[CLAIMS] Claims DISABLED by admin');
      return res.status(200).json({
        success: true,
        message: 'Claims DISABLED',
        disabled: true,
      });
    } else {
      await redis.del(CLAIMS_DISABLED_KEY);
      console.log('[CLAIMS] Claims ENABLED by admin');
      return res.status(200).json({
        success: true,
        message: 'Claims ENABLED',
        disabled: false,
      });
    }
  }

  const featured = await getFeaturedProject();
  if (!featured?.id) {
    return res.status(400).json({ error: 'No featured project' });
  }
  
  if (!featured?.rotationId) {
    return res.status(400).json({ error: 'No rotation ID for featured project' });
  }

  // Find all simple claim keys for this rotation (matches claim key format)
  const pattern = `simple:claim:${featured.rotationId}:*`;
  const keysToDelete = [];
  
  // Also find wallet claim keys to clear
  const walletPattern = `simple:claim:wallet:${featured.rotationId}:*`;
  const walletKeysToDelete = [];

  // Scan for FID claim keys
  try {
    for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      // Skip wallet keys (handled separately)
      if (!key.includes(':wallet:')) {
        keysToDelete.push(key);
      }
    }
  } catch (err) {
    // Fallback scan
    let cursor = '0';
    do {
      const result = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = String(result.cursor ?? result[0] ?? '0');
      const keys = result.keys || result[1] || [];
      for (const key of keys) {
        if (!key.includes(':wallet:')) {
          keysToDelete.push(key);
        }
      }
    } while (cursor !== '0');
  }
  
  // Scan for wallet claim keys
  try {
    for await (const key of redis.scanIterator({ MATCH: walletPattern, COUNT: 100 })) {
      walletKeysToDelete.push(key);
    }
  } catch (err) {
    // Fallback scan
    let cursor = '0';
    do {
      const result = await redis.scan(cursor, { MATCH: walletPattern, COUNT: 100 });
      cursor = String(result.cursor ?? result[0] ?? '0');
      const keys = result.keys || result[1] || [];
      walletKeysToDelete.push(...keys);
    } while (cursor !== '0');
  }

  // Delete all keys
  let deleted = 0;
  let walletDeleted = 0;
  
  if (keysToDelete.length > 0) {
    for (const key of keysToDelete) {
      try {
        await redis.del(key);
        deleted++;
      } catch (e) {
        console.error('Failed to delete key:', key, e.message);
      }
    }
  }
  
  if (walletKeysToDelete.length > 0) {
    for (const key of walletKeysToDelete) {
      try {
        await redis.del(key);
        walletDeleted++;
      } catch (e) {
        console.error('Failed to delete wallet key:', key, e.message);
      }
    }
  }

  console.log('[SIMPLE RESET] Cleared', deleted, 'FID claims and', walletDeleted, 'wallet claims for rotation', featured.rotationId);

  return res.status(200).json({
    success: true,
    message: `Reset ${deleted} FID claims and ${walletDeleted} wallet claims for ${featured.name}`,
    deletedCount: deleted,
    walletDeletedCount: walletDeleted,
    featuredProjectId: featured.id,
    featuredProjectName: featured.name,
    rotationId: featured.rotationId,
  });
}

