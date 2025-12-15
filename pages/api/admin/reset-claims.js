// API route to reset claims for current featured project (admin only)
import { getRedisClient } from '../../../lib/redis';
import { getFeaturedProject } from '../../../lib/projects';
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
    const cookies = parse(req.headers.cookie || '');
    const hasSessionCookie = !!cookies.admin_session;
    const hasFid = !!req.body?.fid;
    const fidMatches = req.body?.fid && parseInt(req.body.fid) === ADMIN_FID;
    
    console.error('Reset claims auth failed:', {
      hasFid,
      fid: req.body?.fid,
      fidMatches,
      hasCookie: !!req.headers.cookie,
      hasSessionCookie,
      adminFid: ADMIN_FID
    });
    
    return res.status(403).json({ 
      error: 'Unauthorized. Admin access required.',
      details: hasSessionCookie 
        ? 'Session cookie found but invalid. Please log in again via the admin login form.'
        : hasFid && !fidMatches
        ? `FID ${req.body.fid} does not match admin FID ${ADMIN_FID}. Please use the correct admin account or log in via web login.`
        : 'No authentication found. Please log in via Farcaster (admin FID) or use the web login form.'
    });
  }

  try {
    const { confirm, resetDonut } = req.body;
    
    if (confirm !== 'RESET') {
      return res.status(400).json({ 
        error: 'Must confirm with confirm: "RESET" to reset claims for the current featured project rotation' 
      });
    }

    const redis = await getRedisClient();
    if (!redis) {
      return res.status(500).json({ error: 'Redis not available' });
    }

    // Get current featured project
    const featuredProject = await getFeaturedProject();
    if (!featuredProject || !featuredProject.id) {
      return res.status(400).json({ error: 'No featured project found' });
    }

    const featuredProjectId = featuredProject.id;
    const featuredAt = featuredProject.featuredAt ? new Date(featuredProject.featuredAt) : new Date();
    const featuredAtTimestamp = Math.floor(featuredAt.getTime() / 1000);
    
    console.log('Resetting claims for:', {
      featuredProjectId,
      featuredAt: featuredAt.toISOString(),
      featuredAtTimestamp,
      resetDonut
    });
    
    // Find all claim keys for this specific featured rotation
    // Pattern includes featuredAt timestamp to only reset current rotation
    const pattern = `claim:featured:${featuredProjectId}:${featuredAtTimestamp}:*`;
    const keys = [];
    
    // Redis SCAN to find all matching keys
    // redis.scan() returns [cursor, keys] tuple in node-redis v4+
    let cursor = 0;
    try {
      do {
        const [nextCursor, foundKeys] = await redis.scan(cursor, {
          MATCH: pattern,
          COUNT: 100
        });
        // Cursor might be string "0" or number 0, convert to number for comparison
        cursor = typeof nextCursor === 'string' ? parseInt(nextCursor, 10) : nextCursor;
        if (foundKeys && foundKeys.length > 0) {
          keys.push(...foundKeys);
        }
      } while (cursor !== 0);
    } catch (scanError) {
      console.error('Error scanning for claim keys:', scanError);
      throw new Error(`Failed to scan for claim keys: ${scanError.message}`);
    }

    // Also find transaction hash keys for this specific featured rotation
    const txPattern = `claim:tx:${featuredProjectId}:${featuredAtTimestamp}:*`;
    const txKeys = [];
    cursor = 0;
    try {
      do {
        const [nextCursor, foundKeys] = await redis.scan(cursor, {
          MATCH: txPattern,
          COUNT: 100
        });
        cursor = typeof nextCursor === 'string' ? parseInt(nextCursor, 10) : nextCursor;
        if (foundKeys && foundKeys.length > 0) {
          txKeys.push(...foundKeys);
        }
      } while (cursor !== 0);
    } catch (scanError) {
      console.error('Error scanning for tx keys:', scanError);
      throw new Error(`Failed to scan for transaction keys: ${scanError.message}`);
    }

    // Also find claim count keys for this specific featured rotation
    const countPattern = `claim:count:${featuredProjectId}:${featuredAtTimestamp}:*`;
    const countKeys = [];
    cursor = 0;
    try {
      do {
        const [nextCursor, foundKeys] = await redis.scan(cursor, {
          MATCH: countPattern,
          COUNT: 100
        });
        cursor = typeof nextCursor === 'string' ? parseInt(nextCursor, 10) : nextCursor;
        if (foundKeys && foundKeys.length > 0) {
          countKeys.push(...foundKeys);
        }
      } while (cursor !== 0);
    } catch (scanError) {
      console.error('Error scanning for count keys:', scanError);
      throw new Error(`Failed to scan for count keys: ${scanError.message}`);
    }

    // Also find wallet claim count keys for this specific featured rotation (security feature)
    const walletPattern = `claim:wallet:${featuredProjectId}:${featuredAtTimestamp}:*`;
    const walletKeys = [];
    cursor = 0;
    try {
      do {
        const [nextCursor, foundKeys] = await redis.scan(cursor, {
          MATCH: walletPattern,
          COUNT: 100
        });
        cursor = typeof nextCursor === 'string' ? parseInt(nextCursor, 10) : nextCursor;
        if (foundKeys && foundKeys.length > 0) {
          walletKeys.push(...foundKeys);
        }
      } while (cursor !== 0);
    } catch (scanError) {
      console.error('Error scanning for wallet keys:', scanError);
      throw new Error(`Failed to scan for wallet keys: ${scanError.message}`);
    }

    // Delete all claim keys for this featured project
    try {
      if (keys.length > 0) {
        await redis.del(keys);
      }
      
      if (txKeys.length > 0) {
        await redis.del(txKeys);
      }
      
      if (countKeys.length > 0) {
        await redis.del(countKeys);
      }
      
      if (walletKeys.length > 0) {
        await redis.del(walletKeys);
      }
    } catch (delError) {
      console.error('Error deleting keys:', delError);
      throw new Error(`Failed to delete keys: ${delError.message}`);
    }

    // Optionally reset DONUT data (if resetDonut is true)
    let donutUsersReset = 0;
    let donutCountReset = false;
    if (resetDonut === true) {
      // Reset global DONUT count
      await redis.del('donut:count:given');
      donutCountReset = true;
      
      // Reset all user DONUT flags
      const donutUserPattern = 'donut:user:*';
      const donutUserKeys = [];
      cursor = 0;
      try {
        do {
          const [nextCursor, foundKeys] = await redis.scan(cursor, {
            MATCH: donutUserPattern,
            COUNT: 100
          });
          cursor = typeof nextCursor === 'string' ? parseInt(nextCursor, 10) : nextCursor;
          if (foundKeys && foundKeys.length > 0) {
            donutUserKeys.push(...foundKeys);
          }
        } while (cursor !== 0);
      } catch (scanError) {
        console.error('Error scanning for DONUT user keys:', scanError);
        throw new Error(`Failed to scan for DONUT user keys: ${scanError.message}`);
      }
      
      if (donutUserKeys.length > 0) {
        try {
          await redis.del(donutUserKeys);
          donutUsersReset = donutUserKeys.length;
        } catch (donutDelError) {
          console.error('Error deleting DONUT user keys:', donutDelError);
          throw new Error(`Failed to delete DONUT user keys: ${donutDelError.message}`);
        }
      }
    }

    console.log('Reset complete:', {
      claimsFound: keys.length,
      countsFound: countKeys.length,
      walletCountsFound: walletKeys.length,
      txFound: txKeys.length,
      donutUsersReset,
      donutCountReset
    });
    
    let message = `Reset ${keys.length} claim(s), ${countKeys.length} FID count(s), ${walletKeys.length} wallet count(s), and ${txKeys.length} transaction(s) for featured project ${featuredProjectId} (rotation started at ${featuredAt.toISOString()})`;
    if (resetDonut) {
      message += `. Also reset DONUT data: ${donutUsersReset} user(s) and global count.`;
    }

    return res.status(200).json({
      success: true,
      message,
      claimsReset: keys.length,
      countsReset: countKeys.length,
      walletCountsReset: walletKeys.length,
      transactionsReset: txKeys.length,
      donutReset: resetDonut === true,
      donutUsersReset,
      donutCountReset,
      featuredProjectId,
      featuredProjectName: featuredProject.name,
      featuredAt: featuredAt.toISOString(),
    });
  } catch (error) {
    console.error('Error resetting claims:', {
      error: error,
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return res.status(500).json({ 
      error: 'Failed to reset claims',
      details: error.message || 'Unknown error occurred',
      type: error.name || 'Error'
    });
  }
}
