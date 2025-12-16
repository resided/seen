// API route to check claim status (tied to featured project rotation)
import { getRedisClient } from '../../../lib/redis';
import { getFeaturedProject, getRotationId } from '../../../lib/projects';
import { getTokenBalance, HOLDER_THRESHOLD } from '../../../lib/token-balance';

const WHALE_CLAIM_LIMIT = 2; // Whales (30M+) can claim 2x daily
const TOKEN_AMOUNT = process.env.CLAIM_TOKEN_AMOUNT || '80000'; // Amount per claim

// DONUT token bonus configuration
const DONUT_MAX_SUPPLY = 1000; // Maximum 1,000 DONUT tokens to give out
const DONUT_COUNT_KEY = 'donut:count:given'; // Redis key to track DONUT tokens given
// DONUT is just an add-on - doesn't change SEEN amount (always 80k per claim)

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
    // Use rotationId which only changes on explicit reset or new featured project (not timer changes)
    const rotationId = await getRotationId();
    const claimCountKey = `claim:count:${featuredProjectId}:${rotationId}:${fid}`;
    const claimCount = parseInt(await redis.get(claimCountKey) || '0');
    
    // User is "fully claimed" when they've used all their claims
    const fullyClaimed = claimCount >= maxClaims;
    const canClaimAgain = claimCount < maxClaims && !expired;

    // Check DONUT availability (global and per-user)
    const donutCountGiven = parseInt(await redis.get(DONUT_COUNT_KEY) || '0');
    const donutGlobalAvailable = donutCountGiven < DONUT_MAX_SUPPLY;
    
    // Check if this user has already received a DONUT (1 per user max)
    const userDonutKey = `donut:user:${fid}`;
    const userHasDonut = await redis.get(userDonutKey);
    const donutAvailable = donutGlobalAvailable && !userHasDonut;
    const donutRemaining = Math.max(0, DONUT_MAX_SUPPLY - donutCountGiven);

    // SECURITY: Test bypass removed - no FID gets special treatment
    const isBypassEnabled = false;

    return res.status(200).json({
      claimed: fullyClaimed,
      claimCount,
      maxClaims,
      canClaimAgain: canClaimAgain,
      expired,
      featuredProjectId,
      featuredAt: featuredAt.toISOString(),
      expirationTime: expirationTime.toISOString(),
      timeRemaining: expired ? 0 : Math.max(0, expirationTime - now),
      isHolder,
      holderThreshold: HOLDER_THRESHOLD,
      donutAvailable, // Whether DONUT bonus is still available for this user
      donutRemaining, // How many DONUT tokens remain globally
      userHasDonut: !!userHasDonut, // Whether this user has already received a DONUT
      // SEEN amount is always 80k per claim - DONUT is just an add-on
      donutBonusSeenAmount: TOKEN_AMOUNT, // Always 80,000 SEEN per claim
    });
  } catch (error) {
    console.error('Error checking claim status:', error);
    return res.status(200).json({ claimed: false, expired: false });
  }
}
