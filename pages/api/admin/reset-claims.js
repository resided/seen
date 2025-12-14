// API route to reset today's daily claims (admin only)
import { getRedisClient } from '../../../lib/redis';
import { parse } from 'cookie';

const ADMIN_FID = 342433; // Admin FID

function isAuthenticated(req) {
  // Check FID authentication (Farcaster)
  const { fid } = req.body || {};
  if (fid && parseInt(fid) === ADMIN_FID) {
    return true;
  }

  // Check session cookie (web login)
  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.admin_session;
  if (sessionToken) {
    return true;
  }

  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check admin authentication
  if (!isAuthenticated(req)) {
    return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
  }

  try {
    const { confirm } = req.body;
    
    if (confirm !== 'RESET') {
      return res.status(400).json({ 
        error: 'Must confirm with confirm: "RESET" to reset all claims for today' 
      });
    }

    const redis = await getRedisClient();
    if (!redis) {
      return res.status(500).json({ error: 'Redis not available' });
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Find all claim keys for today
    const pattern = `claim:daily:*:${today}`;
    const keys = [];
    
    // Redis SCAN to find all matching keys
    let cursor = 0;
    do {
      const result = await redis.scan(cursor, {
        MATCH: pattern,
        COUNT: 100
      });
      cursor = result.cursor;
      keys.push(...result.keys);
    } while (cursor !== 0);

    // Also find transaction hash keys
    const txPattern = `claim:tx:*:${today}`;
    const txKeys = [];
    cursor = 0;
    do {
      const result = await redis.scan(cursor, {
        MATCH: txPattern,
        COUNT: 100
      });
      cursor = result.cursor;
      txKeys.push(...result.keys);
    } while (cursor !== 0);

    // Delete all claim keys for today
    if (keys.length > 0) {
      await redis.del(keys);
    }
    
    if (txKeys.length > 0) {
      await redis.del(txKeys);
    }

    return res.status(200).json({
      success: true,
      message: `Reset ${keys.length} claim(s) and ${txKeys.length} transaction(s) for today (${today})`,
      claimsReset: keys.length,
      transactionsReset: txKeys.length,
      date: today,
    });
  } catch (error) {
    console.error('Error resetting claims:', error);
    return res.status(500).json({ error: 'Failed to reset claims' });
  }
}
