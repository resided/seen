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

    // Helper function to scan Redis keys - uses SCAN command with cursor
    const scanKeys = async (pattern) => {
      const foundKeys = [];
      let cursor = 0;
      
      try {
        do {
          // node-redis v4+ scan returns { cursor, keys } object
          const result = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
          
          // Handle both object format (v4/v5) and array format (older versions)
          if (typeof result === 'object' && !Array.isArray(result)) {
            cursor = result.cursor;
            if (result.keys && result.keys.length > 0) {
              foundKeys.push(...result.keys);
            }
          } else if (Array.isArray(result)) {
            cursor = parseInt(result[0]);
            if (result[1] && result[1].length > 0) {
              foundKeys.push(...result[1]);
            }
          } else {
            break; // Unexpected format
          }
        } while (cursor !== 0);
      } catch (err) {
        console.error(`Error scanning pattern ${pattern}:`, err.message);
      }
      
      return foundKeys;
    };

    const allKeys = [];
    for (const pattern of patterns) {
      const keys = await scanKeys(pattern);
      allKeys.push(...keys);
    }

    // For old claim keys, check if they have old rotationId or timestamp
    // Keys like claim:wallet:global:0x...:rotation-1234567890
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    const keysToDelete = [];

    for (const key of allKeys) {
      // Extract timestamp from rotationId if present (format: rotation-{timestamp})
      const rotationMatch = key.match(/rotation-(\d+)/);
      if (rotationMatch) {
        const timestamp = parseInt(rotationMatch[1]);
        if (timestamp < sevenDaysAgo) {
          keysToDelete.push(key);
        }
      } else {
        // For keys without rotation pattern, check if they have a timestamp segment
        const parts = key.split(':');
        for (const part of parts) {
          const timestamp = parseInt(part);
          // If it looks like a timestamp (13 digits for ms, 10 for seconds)
          if (timestamp > 1600000000000 && timestamp < sevenDaysAgo) {
            keysToDelete.push(key);
            break;
          } else if (timestamp > 1600000000 && timestamp < sevenDaysAgo / 1000) {
            keysToDelete.push(key);
            break;
          }
        }
      }
    }
    
    if (keysToDelete.length > 0) {
      // Delete in batches to avoid issues with large arrays
      const batchSize = 100;
      for (let i = 0; i < keysToDelete.length; i += batchSize) {
        const batch = keysToDelete.slice(i, i + batchSize);
        await redis.del(...batch);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Cleared ${keysToDelete.length} old claim key(s) from ${allKeys.length} total scanned`,
      keysDeleted: keysToDelete.length,
      keysScanned: allKeys.length,
    });
  } catch (error) {
    console.error('Error clearing old claims:', error);
    return res.status(500).json({ error: 'Failed to clear old claims', details: error.message });
  }
}

