// Pre-flight check endpoint - validates if user can claim WITHOUT making any state changes
// Call this BEFORE user signs any transaction to avoid wasted gas

import { getRedisClient } from '../../../lib/redis';
import { getFeaturedProject } from '../../../lib/projects';
import { getTokenBalance, HOLDER_THRESHOLD } from '../../../lib/token-balance';

const MIN_ACCOUNT_AGE_DAYS = 2;

const DEFAULT_CLAIM_SETTINGS = {
  baseClaimAmount: 80000,
  claimMultiplier: 1,
  holderMultiplier: 2,
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

    // Get claim settings
    const claimSettings = await getClaimSettings(redis);
    const { minNeynarScore, cooldownHours, holderMultiplier, claimsEnabled } = claimSettings;

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

    // Check holder status
    let isHolder = false;
    let maxClaims = 1;
    
    try {
      const { isHolder: holderStatus } = await getTokenBalance(walletAddress);
      isHolder = holderStatus;
      if (isHolder) {
        maxClaims = holderMultiplier;
      }
    } catch (e) {
      console.error('Error checking holder status:', e);
    }

    // Check account age (skip for holders)
    if (!isHolder && registeredAt) {
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

    // Check Neynar score (skip for holders)
    if (!isHolder && neynarScore !== null && neynarScore !== undefined) {
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

    // Check personal cooldown
    const personalCooldownKey = `claim:cooldown:${walletLower}`;
    const personalClaimCountKey = `claim:count:personal:${walletLower}`;
    
    const cooldownData = await redis.get(personalCooldownKey);
    const personalClaimCount = parseInt(await redis.get(personalClaimCountKey) || '0');
    
    if (cooldownData) {
      const cooldownExpiry = parseInt(cooldownData);
      const remainingMs = cooldownExpiry - Date.now();
      
      if (remainingMs > 0 && personalClaimCount >= maxClaims) {
        const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
        const remainingMins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        
        return res.status(200).json({ 
          canClaim: false, 
          reason: `Cooldown active. Next claim in ${remainingHours}h ${remainingMins}m`,
          code: 'ON_COOLDOWN',
          cooldownRemaining: remainingMs,
          cooldownEndsAt: new Date(cooldownExpiry).toISOString(),
          claimCount: personalClaimCount,
          maxClaims
        });
      }
    }

    // Check rotation-based claim count
    // CRITICAL: Must match key format in claim/index.js
    const rotationId = featuredProject.rotationId || `legacy_${featuredProject.id}`;
    const globalWalletClaimCountKey = `claim:wallet:global:${featuredProject.id}:${rotationId}:${walletLower}`;
    const currentGlobalCount = parseInt(await redis.get(globalWalletClaimCountKey) || '0');
    
    if (currentGlobalCount >= maxClaims) {
      return res.status(200).json({ 
        canClaim: false, 
        reason: `Already claimed ${maxClaims}x for this featured project`,
        code: 'MAX_CLAIMS_REACHED',
        claimCount: currentGlobalCount,
        maxClaims,
        isHolder
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
      isHolder,
      nextClaimNum: currentGlobalCount + 1,
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

