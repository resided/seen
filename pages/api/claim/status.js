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
      // NO REDIS = CAN CLAIM (fail open for status check)
      return res.status(200).json({ 
        claimed: false, 
        expired: false, 
        canClaimAgain: true,
        claimCount: 0,
        maxClaims: 1
      });
    }

    // Get current featured project
    const featuredProject = await getFeaturedProject();
    if (!featuredProject || !featuredProject.id) {
      return res.status(200).json({ 
        claimed: false, 
        expired: false,
        canClaimAgain: false,
        claimCount: 0,
        maxClaims: 1,
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
    
    // Get rotation ID - this is the key that ties claims to a specific campaign
    const rotationId = await getRotationId();
    
    // Check if user has claimed THIS rotation
    // Key format MUST match claim/index.js exactly
    let rotationClaimCount = 0;
    
    if (walletAddress) {
      const walletLower = walletAddress.toLowerCase();
      const globalWalletClaimCountKey = `claim:wallet:global:${featuredProjectId}:${rotationId}:${walletLower}`;
      
      // Get the actual count from Redis
      const countValue = await redis.get(globalWalletClaimCountKey);
      rotationClaimCount = countValue ? parseInt(countValue) : 0;
      
      // DEBUG: Log what we're checking
      console.log('[STATUS] Checking claim status:', {
        fid,
        wallet: walletLower.slice(0, 10) + '...',
        key: globalWalletClaimCountKey,
        count: rotationClaimCount,
        maxClaims,
        rotationId,
        featuredProjectId,
      });
    }
    
    // User is "fully claimed" when they've used all their claims for this rotation
    const fullyClaimed = rotationClaimCount >= maxClaims;
    const canClaimAgain = rotationClaimCount < maxClaims && !expired;

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

    // Build response - be explicit about everything
    const response = {
      // Core claim status
      claimed: fullyClaimed,
      claimCount: rotationClaimCount,
      maxClaims,
      canClaimAgain: canClaimAgain,
      
      // Project info
      expired,
      featuredProjectId,
      rotationId,
      featuredAt: featuredAt.toISOString(),
      expirationTime: expirationTime.toISOString(),
      timeRemaining: expired ? 0 : Math.max(0, expirationTime - now),
      
      // For debugging
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
    };
    
    // DEBUG: Log what we're returning
    console.log('[STATUS] Returning:', {
      claimed: response.claimed,
      claimCount: response.claimCount,
      canClaimAgain: response.canClaimAgain,
      rotationId: response.rotationId,
    });
    
    return res.status(200).json(response);
  } catch (error) {
    console.error('Error checking claim status:', error);
    // On error, allow claims (fail open for status check - actual claim will validate)
    return res.status(200).json({ 
      claimed: false, 
      expired: false,
      canClaimAgain: true,
      claimCount: 0,
      maxClaims: 1,
      error: 'Status check failed'
    });
  }
}
