// SIMPLE RESET - Clears all simple claims for the current featured project
// No complex logic, just delete the keys

import { getRedisClient } from '../../../lib/redis';
import { getFeaturedProject } from '../../../lib/projects';
import { isAuthenticated } from '../../../lib/admin-auth';

const ADMIN_FID = 342433;


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

  const featured = await getFeaturedProject();
  if (!featured?.id) {
    return res.status(400).json({ error: 'No featured project' });
  }

  // Find all simple claim keys for this featured project
  const pattern = `simple:claim:${featured.id}:*`;
  const keysToDelete = [];

  // Scan for keys
  try {
    for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      keysToDelete.push(key);
    }
  } catch (err) {
    // Fallback scan
    let cursor = '0';
    do {
      const result = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = String(result.cursor ?? result[0] ?? '0');
      const keys = result.keys || result[1] || [];
      keysToDelete.push(...keys);
    } while (cursor !== '0');
  }

  // Delete all keys
  let deleted = 0;
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

  console.log('[SIMPLE RESET] Cleared', deleted, 'claims for featured project', featured.id);

  return res.status(200).json({
    success: true,
    message: `Reset ${deleted} claims for ${featured.name}`,
    deletedCount: deleted,
    featuredProjectId: featured.id,
    featuredProjectName: featured.name,
  });
}

