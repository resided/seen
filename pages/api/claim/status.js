// API route to check claim status (tied to featured project)
import { getRedisClient } from '../../../lib/redis';
import { getFeaturedProject } from '../../../lib/projects';
import { getTokenBalance, HOLDER_THRESHOLD } from '../../../lib/token-balance';

const WHALE_CLAIM_LIMIT = 2; // Whales (30M+) can claim 2x daily

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
    
    // Check if holder (30M+) for 2x claim benefit
    let isHolder = false;
    let maxClaims = 1;
    
    if (walletAddress) {
      try {
        const { isHolder: holderStatus } = await getTokenBalance(walletAddress);
        isHolder = holderStatus;
        if (isHolder) {
          maxClaims = WHALE_CLAIM_LIMIT;
        }
      } catch (balanceError) {
        console.error('Error checking holder status:', balanceError);
      }
    }
    
    // Check claim count for this specific featured rotation
    const featuredAtTimestamp = Math.floor(featuredAt.getTime() / 1000);
    const claimCountKey = `claim:count:${featuredProjectId}:${featuredAtTimestamp}:${fid}`;
    const claimCount = parseInt(await redis.get(claimCountKey) || '0');
    
    // User is "fully claimed" when they've used all their claims
    const fullyClaimed = claimCount >= maxClaims;
    const canClaimAgain = claimCount < maxClaims && !expired;

    // TODO: REMOVE THIS AFTER TESTING - Bypass for testing (FID 342433)
    const TEST_BYPASS_FID = 342433;
    const isBypassEnabled = parseInt(fid) === TEST_BYPASS_FID;

    return res.status(200).json({
      claimed: isBypassEnabled ? false : fullyClaimed,
      claimCount,
      maxClaims,
      canClaimAgain: isBypassEnabled ? true : canClaimAgain,
      expired,
      featuredProjectId,
      featuredAt: featuredAt.toISOString(),
      expirationTime: expirationTime.toISOString(),
      timeRemaining: expired ? 0 : Math.max(0, expirationTime - now),
      isHolder,
      holderThreshold: HOLDER_THRESHOLD,
    });
  } catch (error) {
    console.error('Error checking claim status:', error);
    return res.status(200).json({ claimed: false, expired: false });
  }
}
