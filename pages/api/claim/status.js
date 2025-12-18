// API route to check claim status (tied to featured project rotation)
import { getRedisClient } from '../../../lib/redis';
import { getFeaturedProject, getRotationId } from '../../../lib/projects';

// Default settings (reads from Redis if available)
const DEFAULT_CLAIM_SETTINGS = {
  baseClaimAmount: 40000,
  claimMultiplier: 1,
  cooldownHours: 24,
  minNeynarScore: 0.6,
  claimsEnabled: true,
};
const CLAIM_SETTINGS_KEY = 'claim:settings';

// Helper to get current claim settings from Redis
async function getClaimSettings(redis) {
  try {
    const settingsData = await redis.get(CLAIM_SETTINGS_KEY);
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
    const { fid, walletAddress } = req.body;

    if (!fid) {
      return res.status(400).json({ error: 'FID is required' });
    }

    const redis = await getRedisClient();
    if (!redis) {
      return res.status(200).json({ claimed: false, expired: false });
    }

    // Get current featured project
    const featuredProject = await getFeaturedProject();
    if (!featuredProject || !featuredProject.id) {
      return res.status(200).json({ 
        claimed: false, 
        expired: false,
        noFeaturedProject: true 
      });
    }

    const featuredProjectId = featuredProject.id;
    const featuredAt = featuredProject.featuredAt ? new Date(featuredProject.featuredAt) : new Date();
    
    // Calculate expiration: 24 hours from when project was featured
    const expirationTime = new Date(featuredAt.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    const expired = now > expirationTime;
    
    // Get dynamic claim settings from Redis
    const claimSettings = await getClaimSettings(redis);
    const { baseClaimAmount, claimMultiplier } = claimSettings;
    const tokenAmount = String(Math.floor(baseClaimAmount * claimMultiplier));
    
    // SIMPLIFIED: Always one claim per FID per featured project
    const maxClaims = 1;
    
    // SIMPLIFIED: One claim per FID per featured campaign (rotation)
    // Check rotation-based claim count (what preflight/claim API checks)
    // This is the authoritative source for claims against THIS featured project
    // CRITICAL: Key format must match claim/index.js
    const rotationId = featuredProject.rotationId || `legacy_${featuredProject.id}`;
    const globalWalletClaimCountKey = walletAddress ? `claim:wallet:global:${featuredProject.id}:${rotationId}:${walletAddress.toLowerCase()}` : null;
    let rotationClaimCount = 0;
    
    if (globalWalletClaimCountKey) {
      rotationClaimCount = parseInt(await redis.get(globalWalletClaimCountKey) || '0');
    }
    
    // SIMPLIFIED: One claim per FID per rotation
    // Use rotation-based claim count (FID-based tracking)
    const effectiveClaimCount = rotationClaimCount;
    
    // User is "fully claimed" when they've used all their claims for this rotation
    const fullyClaimed = effectiveClaimCount >= maxClaims;
    const canClaimAgain = effectiveClaimCount < maxClaims && !expired;

    // Check bonus token availability (generic - configured via admin panel)
    let bonusTokenConfig = null;
    let bonusTokenAvailable = false;
    let bonusTokenRemaining = 0;
    let userHasBonusToken = false;
    
    try {
      const bonusConfigJson = await redis.get('bonus:token:config');
      if (bonusConfigJson) {
        bonusTokenConfig = JSON.parse(bonusConfigJson);
        
        if (bonusTokenConfig && bonusTokenConfig.enabled && bonusTokenConfig.contractAddress) {
          const bonusTokenCountKey = `bonus:count:given:${bonusTokenConfig.contractAddress.toLowerCase()}`;
          const bonusCountGiven = parseInt(await redis.get(bonusTokenCountKey) || '0');
          const maxSupply = parseInt(bonusTokenConfig.maxSupply || '0');
          
          bonusTokenRemaining = Math.max(0, maxSupply - bonusCountGiven);
          const bonusGlobalAvailable = bonusCountGiven < maxSupply;
          
          // Check if this user has already received this bonus token (1 per user max)
          const userBonusKey = walletAddress ? `bonus:user:${walletAddress.toLowerCase()}:${bonusTokenConfig.contractAddress.toLowerCase()}` : null;
          if (userBonusKey) {
            userHasBonusToken = !!(await redis.get(userBonusKey));
          }
          
          bonusTokenAvailable = bonusGlobalAvailable && !userHasBonusToken;
        }
      }
    } catch (error) {
      console.error('Error checking bonus token config:', error);
    }

    // SECURITY: Test bypass removed - no FID gets special treatment
    const isBypassEnabled = false;

    return res.status(200).json({
      claimed: fullyClaimed,
      claimCount: effectiveClaimCount, // Use higher of personal or rotation count
      maxClaims,
      canClaimAgain: canClaimAgain,
      expired,
      featuredProjectId,
      rotationId,
      featuredAt: featuredAt.toISOString(),
      expirationTime: expirationTime.toISOString(),
      timeRemaining: expired ? 0 : Math.max(0, expirationTime - now),
      // Rotation-based claim count (FID-based, resets with new featured project)
      rotationClaimCount,
      // Generic bonus token info (configured via admin panel)
      bonusTokenAvailable,
      bonusTokenRemaining,
      userHasBonusToken,
      bonusTokenName: bonusTokenConfig?.tokenName || null,
      bonusTokenAmount: bonusTokenConfig?.amount || null,
      bonusTokenMaxSupply: bonusTokenConfig?.maxSupply || null,
      bonusTokenEnabled: bonusTokenConfig?.enabled || false,
      // SEEN amount per claim (dynamic from admin settings)
      seenAmountPerClaim: tokenAmount,
    });
  } catch (error) {
    console.error('Error checking claim status:', error);
    return res.status(200).json({ claimed: false, expired: false });
  }
}
