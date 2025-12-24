// Centralized FID blocking utilities
// Checks if a user is banned across the entire platform

import { getRedisClient } from './redis';

// Using existing admin blocked FIDs key for compatibility
const BLOCKED_FIDS_KEY = 'admin:blocked:fids';

/**
 * Check if a FID is blocked from using the platform
 * @param {number} fid - Farcaster ID to check
 * @returns {Promise<{isBlocked: boolean, reason?: string}>}
 */
export async function isFidBlocked(fid) {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.warn('[FID BLOCKING] Redis unavailable - allowing request');
      return { isBlocked: false };
    }

    // Get blocked FIDs array (existing format from block-fid.js admin endpoint)
    const blockedFidsJson = await redis.get(BLOCKED_FIDS_KEY);
    const blockedFids = blockedFidsJson ? JSON.parse(blockedFidsJson) : [];

    const fidNum = parseInt(fid);
    const isBlocked = blockedFids.includes(fidNum);

    if (isBlocked) {
      return {
        isBlocked: true,
        reason: 'Account banned from platform',
      };
    }

    return { isBlocked: false };

  } catch (error) {
    console.error('[FID BLOCKING] Error checking if FID is blocked:', error);
    // Fail-open: allow request if check fails (don't block legitimate users due to errors)
    return { isBlocked: false };
  }
}

/**
 * Verify FID is not blocked, return 403 error if blocked
 * Use this in API endpoints to enforce bans
 * @param {Object} res - Next.js response object
 * @param {number} fid - Farcaster ID to check
 * @returns {Promise<boolean>} - True if NOT blocked (safe to proceed), False if blocked (response sent)
 */
export async function checkFidNotBlocked(res, fid) {
  const blockCheck = await isFidBlocked(fid);

  if (blockCheck.isBlocked) {
    console.warn('[FID BLOCKING] Blocked FID attempted access:', {
      fid,
      reason: blockCheck.reason,
      blockedAt: blockCheck.blockedAt,
    });

    res.status(403).json({
      error: 'Account banned from platform',
      reason: blockCheck.reason,
      contact: 'Contact support if you believe this is an error',
    });

    return false; // Blocked
  }

  return true; // Not blocked, safe to proceed
}
