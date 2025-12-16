// API route to clear old/expired claim data (admin only)
import { getRedisClient } from '../../../lib/redis';
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
    const { confirm } = req.body;
    
    if (confirm !== 'CLEAR') {
      return res.status(400).json({ error: 'Must confirm with confirm: "CLEAR"' });
    }

    const redis = await getRedisClient();
    if (!redis) {
      return res.status(500).json({ error: 'Redis not available' });
    }

    // Find all claim-related keys
    const patterns = [
      'claim:featured:*',
      'claim:count:*',
      'claim:wallet:*',
      'claim:wallet:lock:*',
      'claim:wallet:global:*',
      'claim:tx:*',
      'claim:txhash:*',
    ];

    const allKeys = [];
    for (const pattern of patterns) {
      let cursor = 0;
      do {
        const [nextCursor, foundKeys] = await redis.scan(cursor, {
          MATCH: pattern,
          COUNT: 100
        });
        cursor = typeof nextCursor === 'string' ? parseInt(nextCursor, 10) : nextCursor;
        if (foundKeys && foundKeys.length > 0) {
          allKeys.push(...foundKeys);
        }
      } while (cursor !== 0);
    }

    // Check TTL for each key - only delete if expired or very old (> 7 days)
    const now = Math.floor(Date.now() / 1000);
    const expiredKeys = [];
    const oldKeys = [];

    for (const key of allKeys) {
      const ttl = await redis.ttl(key);
      if (ttl === -1) {
        // Key has no expiration - check if it's old by looking at timestamp in key
        // Keys like claim:featured:123:1234567890:456 have timestamp
        const parts = key.split(':');
        if (parts.length >= 4 && parts[2] && parts[3]) {
          const timestamp = parseInt(parts[3]);
          if (timestamp && now - timestamp > 7 * 24 * 60 * 60) {
            oldKeys.push(key);
          }
        } else {
          // No timestamp, consider it old if it exists
          oldKeys.push(key);
        }
      } else if (ttl === -2) {
        // Key doesn't exist (shouldn't happen)
        continue;
      } else if (ttl < 0 || (ttl > 0 && ttl < 60)) {
        // Expired or expiring soon
        expiredKeys.push(key);
      }
    }

    const keysToDelete = [...expiredKeys, ...oldKeys];
    
    if (keysToDelete.length > 0) {
      await redis.del(keysToDelete);
    }

    return res.status(200).json({
      success: true,
      message: `Cleared ${keysToDelete.length} old/expired claim key(s)`,
      expired: expiredKeys.length,
      old: oldKeys.length,
      total: keysToDelete.length,
    });
  } catch (error) {
    console.error('Error clearing old claims:', error);
    return res.status(500).json({ error: 'Failed to clear old claims', details: error.message });
  }
}

