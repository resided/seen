// API route to reset ONLY bonus token eligibility (does NOT reset claims)
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
    
    if (confirm !== 'RESET_BONUS') {
      return res.status(400).json({ 
        error: 'Must confirm with confirm: "RESET_BONUS" to reset bonus token eligibility' 
      });
    }

    const redis = await getRedisClient();
    if (!redis) {
      return res.status(500).json({ error: 'Redis not available' });
    }

    // Helper function to scan Redis keys with v5 compatibility
    const scanKeys = async (scanPattern) => {
      const foundKeys = [];
      try {
        // Try scanIterator first (node-redis v5)
        for await (const key of redis.scanIterator({ MATCH: scanPattern, COUNT: 100 })) {
          foundKeys.push(key);
        }
      } catch (err) {
        // Fallback to manual scan
        let cursor = '0';
        do {
          const result = await redis.scan(cursor, { MATCH: scanPattern, COUNT: 100 });
          cursor = String(result.cursor ?? result[0] ?? '0');
          const keys = result.keys || result[1] || [];
          if (keys.length > 0) foundKeys.push(...keys);
        } while (cursor !== '0');
      }
      return foundKeys;
    };

    // Helper function to delete keys
    const deleteKeys = async (keysToDelete) => {
      if (!keysToDelete || keysToDelete.length === 0) return 0;
      try {
        await redis.del(...keysToDelete);
        return keysToDelete.length;
      } catch (err) {
        console.warn('Batch delete failed, trying one by one:', err.message);
        let deleted = 0;
        for (const key of keysToDelete) {
          try {
            await redis.del(key);
            deleted++;
          } catch (singleErr) {
            console.error(`Failed to delete key ${key}:`, singleErr.message);
          }
        }
        return deleted;
      }
    };

    // ONLY clear bonus token eligibility - DO NOT touch claims
    const bonusUserKeys = await scanKeys('bonus:user:*');
    const bonusCountKeys = await scanKeys('bonus:count:given:*');
    
    // Also clear old DONUT keys (legacy)
    const donutUserKeys = await scanKeys('donut:user:*');
    
    const bonusUsersReset = await deleteKeys(bonusUserKeys);
    const bonusCountsReset = await deleteKeys(bonusCountKeys);
    const donutUsersReset = await deleteKeys(donutUserKeys);
    
    // Reset global bonus count to 0
    for (const countKey of bonusCountKeys) {
      await redis.set(countKey, '0');
    }
    
    // Also reset legacy DONUT count
    await redis.del('donut:count:given');

    console.log('Bonus eligibility reset complete:', {
      bonusUsersReset,
      bonusCountsReset,
      donutUsersReset,
    });

    return res.status(200).json({
      success: true,
      message: `Reset bonus token eligibility: ${bonusUsersReset} user flags, ${bonusCountsReset} count keys cleared. Claims were NOT affected.`,
      bonusUsersReset,
      bonusCountsReset,
      donutUsersReset,
    });
  } catch (error) {
    console.error('Error resetting bonus eligibility:', error);
    return res.status(500).json({ 
      error: 'Failed to reset bonus eligibility',
      details: error.message 
    });
  }
}

