// API route to reset claims for current featured project (admin only)
import { getRedisClient } from '../../../lib/redis';
import { getFeaturedProject, resetRotationId, getRotationId } from '../../../lib/projects';
import { parse } from 'cookie';

const ADMIN_FID = 342433; // Admin FID

function isAuthenticated(req) {
  // SECURITY: Require ADMIN_SECRET for all admin operations
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    console.error('ADMIN_SECRET not configured - admin endpoints disabled');
    return false;
  }
  
  // Check for secret in header or body
  const providedSecret = req.headers['x-admin-secret'] || req.body?.adminSecret;
  if (providedSecret && providedSecret === adminSecret) {
    return true;
  }

  // Check session cookie (web login) - only if ADMIN_PASSWORD is properly set
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
    
    // Get current rotation ID before reset
    const oldRotationId = await getRotationId();
    
    // Generate a new rotation ID - this is the KEY to resetting claims
    // All claim keys use rotationId, so a new rotationId = fresh slate for everyone
    const newRotationId = await resetRotationId();
    
    console.log('Resetting claims for:', {
      featuredProjectId,
      featuredAt: featuredAt.toISOString(),
      oldRotationId,
      newRotationId,
      resetDonut
    });
    
    // Find all claim keys for this specific featured rotation (old rotation ID)
    // Pattern includes rotation ID to only reset current rotation
    const pattern = `claim:featured:${featuredProjectId}:${oldRotationId}:*`;
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
    const txPattern = `claim:tx:${featuredProjectId}:${oldRotationId}:*`;
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
    const countPattern = `claim:count:${featuredProjectId}:${oldRotationId}:*`;
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
    const walletPattern = `claim:wallet:${featuredProjectId}:${oldRotationId}:*`;
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

    // CRITICAL: Also find wallet lock keys for this featured rotation (prevents multi-claim exploits)
    const walletLockPattern = `claim:wallet:lock:*`;
    const walletLockKeys = [];
    cursor = 0;
    try {
      do {
        const [nextCursor, foundKeys] = await redis.scan(cursor, {
          MATCH: walletLockPattern,
          COUNT: 100
        });
        cursor = typeof nextCursor === 'string' ? parseInt(nextCursor, 10) : nextCursor;
        if (foundKeys && foundKeys.length > 0) {
          walletLockKeys.push(...foundKeys);
        }
      } while (cursor !== 0);
    } catch (scanError) {
      console.error('Error scanning for wallet lock keys:', scanError);
      throw new Error(`Failed to scan for wallet lock keys: ${scanError.message}`);
    }

    // CRITICAL: Also find global wallet claim count keys (prevents cross-rotation exploits)
    const globalWalletPattern = `claim:wallet:global:*`;
    const globalWalletKeys = [];
    cursor = 0;
    try {
      do {
        const [nextCursor, foundKeys] = await redis.scan(cursor, {
          MATCH: globalWalletPattern,
          COUNT: 100
        });
        cursor = typeof nextCursor === 'string' ? parseInt(nextCursor, 10) : nextCursor;
        if (foundKeys && foundKeys.length > 0) {
          globalWalletKeys.push(...foundKeys);
        }
      } while (cursor !== 0);
    } catch (scanError) {
      console.error('Error scanning for global wallet keys:', scanError);
      throw new Error(`Failed to scan for global wallet keys: ${scanError.message}`);
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
      
      // CRITICAL: Delete wallet lock keys (prevents multi-claim exploits)
      if (walletLockKeys.length > 0) {
        await redis.del(walletLockKeys);
      }
      
      // CRITICAL: Delete global wallet claim count keys (prevents cross-rotation exploits)
      if (globalWalletKeys.length > 0) {
        await redis.del(globalWalletKeys);
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

    // CLEAR ALL PERSONAL 24-HOUR COOLDOWNS
    // This allows everyone to claim again immediately
    const personalCooldownPattern = 'claim:cooldown:*';
    const personalCooldownKeys = [];
    let cooldownCursor = 0;
    try {
      do {
        const [nextCursor, foundKeys] = await redis.scan(cooldownCursor, {
          MATCH: personalCooldownPattern,
          COUNT: 100
        });
        cooldownCursor = typeof nextCursor === 'string' ? parseInt(nextCursor, 10) : nextCursor;
        if (foundKeys && foundKeys.length > 0) {
          personalCooldownKeys.push(...foundKeys);
        }
      } while (cooldownCursor !== 0);
    } catch (scanError) {
      console.error('Error scanning for personal cooldown keys:', scanError);
    }
    
    // Also clear personal claim count keys
    const personalClaimCountPattern = 'claim:count:personal:*';
    const personalClaimCountKeys = [];
    cooldownCursor = 0;
    try {
      do {
        const [nextCursor, foundKeys] = await redis.scan(cooldownCursor, {
          MATCH: personalClaimCountPattern,
          COUNT: 100
        });
        cooldownCursor = typeof nextCursor === 'string' ? parseInt(nextCursor, 10) : nextCursor;
        if (foundKeys && foundKeys.length > 0) {
          personalClaimCountKeys.push(...foundKeys);
        }
      } while (cooldownCursor !== 0);
    } catch (scanError) {
      console.error('Error scanning for personal claim count keys:', scanError);
    }
    
    let personalCooldownsReset = 0;
    if (personalCooldownKeys.length > 0 || personalClaimCountKeys.length > 0) {
      try {
        const allPersonalKeys = [...personalCooldownKeys, ...personalClaimCountKeys];
        if (allPersonalKeys.length > 0) {
          await redis.del(allPersonalKeys);
          personalCooldownsReset = allPersonalKeys.length;
        }
      } catch (delError) {
        console.error('Error deleting personal cooldown keys:', delError);
      }
    }

    console.log('Reset complete:', {
      claimsFound: keys.length,
      countsFound: countKeys.length,
      walletCountsFound: walletKeys.length,
      walletLocksFound: walletLockKeys.length,
      globalWalletsFound: globalWalletKeys.length,
      txFound: txKeys.length,
      personalCooldownsReset,
      donutUsersReset,
      donutCountReset
    });
    
    let message = `Reset ${keys.length} claim(s), ${countKeys.length} FID count(s), ${walletKeys.length} wallet count(s), ${walletLockKeys.length} wallet lock(s), ${globalWalletKeys.length} global wallet count(s), ${txKeys.length} transaction(s), and ${personalCooldownsReset} personal cooldown(s) for featured project ${featuredProjectId}`;
    if (resetDonut) {
      message += `. Also reset DONUT data: ${donutUsersReset} user(s) and global count.`;
    }

    return res.status(200).json({
      success: true,
      message,
      claimsReset: keys.length,
      countsReset: countKeys.length,
      walletCountsReset: walletKeys.length,
      walletLocksReset: walletLockKeys.length,
      globalWalletCountsReset: globalWalletKeys.length,
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
