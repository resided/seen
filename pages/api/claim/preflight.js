// Pre-flight check endpoint - validates if user can claim WITHOUT making any state changes
// Call this BEFORE user signs any transaction to avoid wasted gas

import { getRedisClient } from '../../../lib/redis';
import { getFeaturedProject } from '../../../lib/projects';

const MIN_ACCOUNT_AGE_DAYS = 2;

const DEFAULT_CLAIM_SETTINGS = {
  baseClaimAmount: 80000,
  claimMultiplier: 1,
  cooldownHours: 24,
  minNeynarScore: 0.6,
  claimsEnabled: true,
};

async function getClaimSettings(redis) {
  try {
    const settingsData = await redis.get('claim:settings');
    if (!settingsData) return DEFAULT_CLAIM_SETTINGS;
    return { ...DEFAULT_CLAIM_SETTINGS, ...JSON.parse(settingsData) };
  } catch (error) {
    console.error('Error fetching claim settings:', error);
    return DEFAULT_CLAIM_SETTINGS;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fid, walletAddress, neynarScore, registeredAt } = req.body;

    // Basic validation
    if (!fid) {
      return res.status(200).json({ 
        canClaim: false, 
        reason: 'FID is required',
        code: 'NO_FID'
      });
    }

    const fidNum = parseInt(fid);
    if (isNaN(fidNum) || fidNum <= 0) {
      return res.status(200).json({ 
        canClaim: false, 
        reason: 'Invalid FID',
        code: 'INVALID_FID'
      });
    }

    if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(200).json({ 
        canClaim: false, 
        reason: 'Valid wallet address required',
        code: 'NO_WALLET'
      });
    }

    const walletLower = walletAddress.toLowerCase();
    const redis = await getRedisClient();
    
    if (!redis) {
      return res.status(200).json({ 
        canClaim: false, 
        reason: 'Service temporarily unavailable',
        code: 'SERVICE_ERROR'
      });
    }

    // SECURITY: Check if FID is blocked
    const BLOCKED_FIDS_KEY = 'admin:blocked:fids';
    const blockedFidsJson = await redis.get(BLOCKED_FIDS_KEY);
    if (blockedFidsJson) {
      const blockedFids = JSON.parse(blockedFidsJson);
      if (blockedFids.includes(fidNum)) {
        return res.status(200).json({ 
          canClaim: false, 
          reason: 'This account has been blocked from claiming',
          code: 'FID_BLOCKED'
        });
      }
    }

    // Get claim settings
    const claimSettings = await getClaimSettings(redis);
    const { minNeynarScore, cooldownHours, claimsEnabled } = claimSettings;

    // Check if claims are enabled globally
    if (!claimsEnabled) {
      return res.status(200).json({ 
        canClaim: false, 
        reason: 'Claims are currently disabled',
        code: 'CLAIMS_DISABLED'
      });
    }

    // Check for featured project
    const featuredProject = await getFeaturedProject();
    if (!featuredProject || !featuredProject.id) {
      return res.status(200).json({ 
        canClaim: false, 
        reason: 'No featured project available',
        code: 'NO_FEATURED'
      });
    }

    // Check expiration
    const featuredAt = featuredProject.featuredAt ? new Date(featuredProject.featuredAt) : new Date();
    const expirationTime = new Date(featuredAt.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    
    if (now > expirationTime) {
      return res.status(200).json({ 
        canClaim: false, 
        reason: 'Claim window has expired',
        code: 'EXPIRED',
        expired: true
      });
    }

    // SIMPLIFIED: Always one claim per FID per featured project
    const maxClaims = 1;

    // Check account age
    if (registeredAt) {
      const registeredDate = new Date(registeredAt * 1000);
      const accountAgeMs = Date.now() - registeredDate.getTime();
      const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);
      
      if (accountAgeDays < MIN_ACCOUNT_AGE_DAYS) {
        return res.status(200).json({ 
          canClaim: false, 
          reason: `Account must be at least ${MIN_ACCOUNT_AGE_DAYS} days old`,
          code: 'ACCOUNT_TOO_NEW',
          accountAgeDays: Math.floor(accountAgeDays),
          requiredDays: MIN_ACCOUNT_AGE_DAYS
        });
      }
    }

    // Check Neynar score
    {
      if (neynarScore === null || neynarScore === undefined) {
        // STRICT: If score is not provided, block claim
        return res.status(200).json({ 
          canClaim: false, 
          reason: `Neynar user score is required but not available. Please try again later.`,
          code: 'SCORE_UNAVAILABLE'
        });
      }
      
      if (neynarScore < minNeynarScore) {
        return res.status(200).json({ 
          canClaim: false, 
          reason: `Neynar score (${neynarScore.toFixed(2)}) below minimum (${minNeynarScore})`,
          code: 'LOW_SCORE',
          userScore: neynarScore,
          requiredScore: minNeynarScore
        });
      }
    }

    // SIMPLIFIED: No personal cooldown - FID can only claim once per rotation

    // Check rotation-based claim count
    // CRITICAL: Must match key format in claim/index.js
    const rotationId = featuredProject.rotationId || `legacy_${featuredProject.id}`;
    const globalWalletClaimCountKey = `claim:wallet:global:${featuredProject.id}:${rotationId}:${walletLower}`;
    const currentGlobalCount = parseInt(await redis.get(globalWalletClaimCountKey) || '0');
    
    if (currentGlobalCount >= maxClaims) {
      return res.status(200).json({ 
        canClaim: false, 
        reason: `Already claimed for this featured project`,
        code: 'MAX_CLAIMS_REACHED',
        claimCount: currentGlobalCount,
        maxClaims
      });
    }

    // Check if there's already a pending reservation for this wallet
    const reservationKey = `claim:reservation:${walletLower}`;
    const existingReservation = await redis.get(reservationKey);
    
    if (existingReservation) {
      const reservation = JSON.parse(existingReservation);
      const reservationAge = Date.now() - reservation.createdAt;
      
      // Reservations expire after 2 minutes
      if (reservationAge < 120000) {
        return res.status(200).json({ 
          canClaim: false, 
          reason: 'You have a pending claim. Please complete or wait.',
          code: 'PENDING_RESERVATION',
          reservationId: reservation.id,
          expiresIn: Math.floor((120000 - reservationAge) / 1000)
        });
      }
    }

    // All checks passed - user CAN claim
    return res.status(200).json({
      canClaim: true,
      reason: 'Eligible to claim',
      code: 'ELIGIBLE',
      claimCount: currentGlobalCount,
      maxClaims,
      featuredProjectId: featuredProject.id,
      rotationId,
      expiresAt: expirationTime.toISOString(),
      tokenAmount: claimSettings.baseClaimAmount * claimSettings.claimMultiplier
    });

  } catch (error) {
    console.error('Preflight check error:', error);
    return res.status(200).json({ 
      canClaim: false, 
      reason: 'Error checking eligibility',
      code: 'ERROR'
    });
  }
}

