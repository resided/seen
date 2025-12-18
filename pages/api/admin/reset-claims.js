// API route to reset claims for current featured project (admin only)
import { getRedisClient } from '../../../lib/redis';
import { getFeaturedProject, getRotationId } from '../../../lib/projects';
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
    const { confirm, resetDonut, nuclearReset } = req.body;
    
    if (confirm !== 'RESET') {
      return res.status(400).json({ 
        error: 'Must confirm with confirm: "RESET" to reset claims for the current featured project rotation' 
      });
    }
    
    // NUCLEAR RESET: Clear ALL claim-related keys regardless of rotation
    // Use this if normal reset isn't working
    const useNuclearReset = nuclearReset === true;

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
    
    // Get current rotation ID - DO NOT RESET IT
    // Resetting rotation ID would also reset stats (views/clicks)
    // Instead, we just delete the claim-related keys directly
    const currentRotationId = await getRotationId();
    
    console.log('Resetting claims for:', {
      featuredProjectId,
      featuredAt: featuredAt.toISOString(),
      rotationId: currentRotationId,
      resetDonut
    });
    
    // Helper function to scan Redis keys with v5 compatibility
    const scanKeys = async (scanPattern) => {
      const foundKeys = [];
      try {
        // Try scanIterator first (node-redis v5)
        for await (const key of redis.scanIterator({ MATCH: scanPattern, COUNT: 100 })) {
          foundKeys.push(key);
        }
      } catch (err) {
        console.warn(`scanIterator failed for ${scanPattern}, trying fallback:`, err.message);
        // Fallback to manual scan
        try {
          let cursor = '0';
          do {
            const result = await redis.scan(cursor, { MATCH: scanPattern, COUNT: 100 });
            cursor = String(result.cursor ?? result[0] ?? '0');
            const keys = result.keys || result[1] || [];
            if (keys.length > 0) foundKeys.push(...keys);
          } while (cursor !== '0');
        } catch (fallbackErr) {
          console.error(`Fallback scan also failed for ${scanPattern}:`, fallbackErr.message);
        }
      }
      return foundKeys;
    };

    // Find all claim keys
    // If nuclearReset, clear ALL claim keys regardless of rotation
    // Otherwise, only clear keys for current rotation
    let keys, txKeys, countKeys, walletKeys, globalWalletKeys;
    
    if (useNuclearReset) {
      console.log('🔴 NUCLEAR RESET - clearing ALL claim keys');
      keys = await scanKeys('claim:featured:*');
      txKeys = await scanKeys('claim:tx:*');
      countKeys = await scanKeys('claim:count:*');
      walletKeys = await scanKeys('claim:wallet:*');
      globalWalletKeys = await scanKeys('claim:wallet:global:*');
    } else {
      // Standard reset - only current rotation
      const pattern = `claim:featured:${featuredProjectId}:${currentRotationId}:*`;
      keys = await scanKeys(pattern);

      const txPattern = `claim:tx:${featuredProjectId}:${currentRotationId}:*`;
      txKeys = await scanKeys(txPattern);

      const countPattern = `claim:count:${featuredProjectId}:${currentRotationId}:*`;
      countKeys = await scanKeys(countPattern);

      const walletPattern = `claim:wallet:${featuredProjectId}:${currentRotationId}:*`;
      walletKeys = await scanKeys(walletPattern);

      const globalWalletPattern = `claim:wallet:global:${featuredProjectId}:${currentRotationId}:*`;
      globalWalletKeys = await scanKeys(globalWalletPattern);
    }

    // ALWAYS clear these regardless (they're not rotation-specific)
    const claimLockPattern = `claim:lock:*`;
    const claimLockKeys = await scanKeys(claimLockPattern);
    
    const reservationPattern = `claim:reserve:*`;
    const reservationKeys = await scanKeys(reservationPattern);
    
    console.log('Keys to delete:', {
      nuclearReset: useNuclearReset,
      keys: keys.length,
      txKeys: txKeys.length,
      countKeys: countKeys.length,
      walletKeys: walletKeys.length,
      globalWalletKeys: globalWalletKeys.length,
      claimLockKeys: claimLockKeys.length,
      reservationKeys: reservationKeys.length,
    });

    // Helper function to delete keys (handles node-redis v5 compatibility)
    const deleteKeys = async (keysToDelete) => {
      if (!keysToDelete || keysToDelete.length === 0) return 0;
      
      // Filter out any invalid keys (undefined, null, empty, non-string)
      const validKeys = keysToDelete.filter(key => key && typeof key === 'string' && key.trim().length > 0);
      if (validKeys.length === 0) return 0;
      
      try {
        // Try array format first (works with most Redis clients)
        if (validKeys.length === 1) {
          // Single key - direct delete
          await redis.del(validKeys[0]);
          return 1;
        } else {
          // Multiple keys - try array format first
          try {
            await redis.del(validKeys);
            return validKeys.length;
          } catch (arrayErr) {
            // If array doesn't work, try spread operator
            await redis.del(...validKeys);
            return validKeys.length;
          }
        }
      } catch (err) {
        // Fallback: try deleting one by one
        console.warn('Batch delete failed, trying one by one:', err.message);
        let deleted = 0;
        for (const key of validKeys) {
          if (!key || typeof key !== 'string' || key.trim().length === 0) {
            console.warn('Skipping invalid key:', key);
            continue;
          }
          try {
            const result = await redis.del(key);
            if (result > 0) deleted++;
          } catch (singleErr) {
            console.error(`Failed to delete key "${key}":`, singleErr.message);
          }
        }
        return deleted;
      }
    };

    // Delete all claim keys for this featured project
    try {
      await deleteKeys(keys);
      await deleteKeys(txKeys);
      await deleteKeys(countKeys);
      await deleteKeys(walletKeys);
      await deleteKeys(claimLockKeys);
      await deleteKeys(reservationKeys);
      await deleteKeys(globalWalletKeys);
    } catch (delError) {
      console.error('Error deleting keys:', delError);
      throw new Error(`Failed to delete keys: ${delError.message}`);
    }

    // Optionally reset DONUT and bonus token data (if resetDonut is true)
    let donutUsersReset = 0;
    let donutCountReset = false;
    let bonusUsersReset = 0;
    let bonusCountsReset = 0;
    if (resetDonut === true) {
      // Reset global DONUT count
      await redis.del('donut:count:given');
      donutCountReset = true;
      
      // Reset all user DONUT flags
      const donutUserKeys = await scanKeys('donut:user:*');
      donutUsersReset = await deleteKeys(donutUserKeys);
      
      // Also reset all BONUS TOKEN user flags (for admin-configured bonus tokens like DONUT)
      const bonusUserKeys = await scanKeys('bonus:user:*');
      bonusUsersReset = await deleteKeys(bonusUserKeys);
      
      // Reset all BONUS TOKEN count keys
      const bonusCountKeys = await scanKeys('bonus:count:given:*');
      bonusCountsReset = await deleteKeys(bonusCountKeys);
    }

    // NOTE: Personal cooldowns and FID holder cache were removed in simplified claim system
    // These keys no longer exist, but we keep the scan for backwards compatibility
    // (in case old keys are still in Redis from previous versions)
    const personalCooldownKeys = await scanKeys('claim:cooldown:*');
    const personalClaimCountKeys = await scanKeys('claim:count:personal:*');
    const fidHolderCacheKeys = await scanKeys('claim:fid:holder:*');
    
    // CRITICAL: Clear wallet-level rate limit keys (prevents "too many claims from this wallet" error)
    // Format in rate-limit.js: ratelimit:${identifier}
    // Format in claim/index.js: checkRateLimit('claim:wallet:${walletAddress}', ...)
    // So the actual key is: ratelimit:claim:wallet:${walletAddress}
    
    // Scan ALL rate limit keys first, then filter (more reliable than pattern matching)
    const allRateLimitKeys = await scanKeys('ratelimit:*');
    const walletRateLimitKeys = allRateLimitKeys.filter(key => 
      key.includes('claim') && key.includes('wallet')
    );
    const ipRateLimitKeys = allRateLimitKeys.filter(key => 
      key.includes('claim') && key.includes('ip')
    );
    
    console.log('Rate limit keys found:', {
      totalRateLimitKeys: allRateLimitKeys.length,
      walletRateLimits: walletRateLimitKeys.length,
      ipRateLimits: ipRateLimitKeys.length,
      sampleWalletKeys: walletRateLimitKeys.slice(0, 5),
      sampleIpKeys: ipRateLimitKeys.slice(0, 5),
      allClaimRelated: allRateLimitKeys.filter(k => k.includes('claim')).length,
    });
    
    const allPersonalKeys = [...personalCooldownKeys, ...personalClaimCountKeys, ...fidHolderCacheKeys];
    const personalCooldownsReset = await deleteKeys(allPersonalKeys);
    const walletRateLimitsReset = await deleteKeys(walletRateLimitKeys);
    const ipRateLimitsReset = await deleteKeys(ipRateLimitKeys);

    console.log('Reset complete:', {
      claimsFound: keys.length,
      countsFound: countKeys.length,
      walletCountsFound: walletKeys.length,
      claimLocksFound: claimLockKeys.length,
      reservationsFound: reservationKeys.length,
      globalWalletsFound: globalWalletKeys.length,
      txFound: txKeys.length,
      personalCooldownsReset,
      walletRateLimitsReset,
      ipRateLimitsReset,
      donutUsersReset,
      donutCountReset
    });
    
    let message = `Reset ${keys.length} claim(s), ${countKeys.length} FID count(s), ${walletKeys.length} wallet count(s), ${claimLockKeys.length} claim lock(s), ${reservationKeys.length} reservation(s), ${globalWalletKeys.length} global wallet count(s), ${txKeys.length} transaction(s), ${personalCooldownsReset} personal cooldown(s), ${walletRateLimitsReset} wallet rate limit(s), and ${ipRateLimitsReset} IP rate limit(s) for featured project ${featuredProjectId}`;
    if (resetDonut) {
      message += `. Also reset DONUT data: ${donutUsersReset} user(s) and global count. Bonus token data: ${bonusUsersReset} user(s), ${bonusCountsReset} count key(s).`;
    }

    return res.status(200).json({
      success: true,
      message,
      claimsReset: keys.length,
      countsReset: countKeys.length,
      walletCountsReset: walletKeys.length,
      claimLocksReset: claimLockKeys.length,
      reservationsReset: reservationKeys.length,
      globalWalletCountsReset: globalWalletKeys.length,
      transactionsReset: txKeys.length,
      personalCooldownsReset,
      walletRateLimitsReset,
      ipRateLimitsReset,
      donutReset: resetDonut === true,
      donutUsersReset,
      donutCountReset,
      bonusUsersReset,
      bonusCountsReset,
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
