// API route to claim tokens (tied to featured project rotation)
import { getRedisClient } from '../../../lib/redis';
import { getFeaturedProject, getRotationId } from '../../../lib/projects';
import { fetchUserByFid } from '../../../lib/neynar';
import { createWalletClient, createPublicClient, http, parseUnits, getAddress } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { erc20Abi } from 'viem';
import { checkRateLimit, getClientIP } from '../../../lib/rate-limit';

// Token configuration from environment variables
const TOKEN_CONTRACT = process.env.CLAIM_TOKEN_CONTRACT; // ERC20 token contract address
const TOKEN_DECIMALS = parseInt(process.env.CLAIM_TOKEN_DECIMALS || '18'); // Token decimals

// Default settings (can be overridden via admin panel)
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
const TREASURY_PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY; // Private key of wallet holding tokens (0x prefix)
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS; // Treasury wallet address (for verification) - REQUIRED
const REQUIRE_USER_TX = process.env.REQUIRE_USER_TX !== 'false'; // Allow disabling in env if needed

// Configurable bonus token system - ALL bonus tokens configured via admin panel
// No more hardcoded tokens - everything is dynamic and configurable
const BONUS_TOKEN_CONFIG_KEY = 'bonus:token:config'; // Redis key for bonus token config

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // EMERGENCY KILL SWITCH - set CLAIMS_DISABLED=true in Vercel env to stop all claims
  if (process.env.CLAIMS_DISABLED === 'true') {
    return res.status(503).json({ error: 'Claims temporarily disabled for maintenance' });
  }

  // Rate limiting: 10 claims per IP per minute, 3 claims per wallet per hour
  const clientIP = getClientIP(req);
  const ipRateLimit = await checkRateLimit(`claim:ip:${clientIP}`, 10, 60000); // 10 per minute
  if (!ipRateLimit.allowed) {
    return res.status(429).json({ 
      error: 'Too many claim requests. Please slow down.',
      retryAfter: Math.ceil((ipRateLimit.resetAt - Date.now()) / 1000)
    });
  }

  try {
    let { fid, walletAddress, txHash, reservationId } = req.body;

    // Validate and sanitize inputs
    if (!fid) {
      return res.status(400).json({ error: 'FID is required' });
    }

    // Parse and validate FID
    const fidNum = parseInt(fid);
    if (isNaN(fidNum) || fidNum <= 0) {
      return res.status(400).json({ error: 'Invalid FID' });
    }
    fid = fidNum; // Use parsed integer

    // Validate wallet address format if provided
    if (walletAddress) {
      const walletLower = walletAddress.toLowerCase().trim();
      if (!walletLower.match(/^0x[a-fA-F0-9]{40}$/)) {
        return res.status(400).json({ error: 'Invalid wallet address format' });
      }
      walletAddress = walletLower; // Normalize to lowercase
    }

    // Validate transaction hash format if provided
    if (txHash) {
      const txHashLower = txHash.toLowerCase().trim();
      if (!txHashLower.match(/^0x[a-fA-F0-9]{64}$/)) {
        return res.status(400).json({ error: 'Invalid transaction hash format' });
      }
      txHash = txHashLower; // Normalize to lowercase
    }

    // Either walletAddress OR txHash is required
    if (!walletAddress && !txHash) {
      return res.status(400).json({ error: 'Wallet address or transaction hash is required for claiming' });
    }

    // SECURITY: Check if FID is blocked
    const BLOCKED_FIDS_KEY = 'admin:blocked:fids';
    const blockedFidsJson = await redis.get(BLOCKED_FIDS_KEY);
    if (blockedFidsJson) {
      const blockedFids = JSON.parse(blockedFidsJson);
      if (blockedFids.includes(fidNum)) {
        console.warn(`[SECURITY] Blocked FID ${fidNum} attempted to claim`);
        return res.status(403).json({ 
          error: 'This account has been blocked from claiming',
          code: 'FID_BLOCKED'
        });
      }
    }

    // Additional wallet-level rate limiting (only if walletAddress provided)
    if (walletAddress) {
      const walletRateLimit = await checkRateLimit(`claim:wallet:${walletAddress}`, 3, 3600000); // 3 per hour
      if (!walletRateLimit.allowed) {
        return res.status(429).json({ 
          error: 'Too many claims from this wallet. Please wait before claiming again.',
          retryAfter: Math.ceil((walletRateLimit.resetAt - Date.now()) / 1000)
        });
      }

      // SECURITY: Blocklist known exploiter wallets
      const BLOCKED_WALLETS = [
        '0xda9623023a2dd7f1ce4e68772c3a0b57ad420260',
        '0x1915a871dea94e538a3c9ec671574ffdee6e7c45',
      ];
      if (BLOCKED_WALLETS.includes(walletAddress)) {
        console.error('BLOCKED WALLET ATTEMPTED CLAIM:', walletAddress);
        return res.status(403).json({ error: 'Wallet blocked due to suspicious activity' });
      }
    }

    const redis = await getRedisClient();
    if (!redis) {
      return res.status(500).json({ error: 'Service unavailable' });
    }

    // RESERVATION VALIDATION
    // If a reservationId is provided, validate it and use reservation data
    let reservation = null;
    const reservationKey = walletAddress ? `claim:reservation:${walletAddress}` : null;
    
    if (reservationId && reservationKey) {
      const reservationData = await redis.get(reservationKey);
      
      if (!reservationData) {
        return res.status(400).json({ 
          error: 'Reservation expired or not found. Please start a new claim.',
          code: 'RESERVATION_EXPIRED'
        });
      }
      
      reservation = JSON.parse(reservationData);
      
      // Verify reservation matches
      if (reservation.id !== reservationId) {
        return res.status(400).json({ 
          error: 'Reservation ID mismatch. Please start a new claim.',
          code: 'RESERVATION_MISMATCH'
        });
      }
      
      // Verify wallet matches
      if (reservation.walletAddress !== walletAddress) {
        return res.status(400).json({ 
          error: 'Wallet address does not match reservation.',
          code: 'WALLET_MISMATCH'
        });
      }
      
      // Check if reservation is still valid (within 2 minutes)
      const reservationAge = Date.now() - reservation.createdAt;
      if (reservationAge > 120000) {
        await redis.del(reservationKey);
        return res.status(400).json({ 
          error: 'Reservation expired. Please start a new claim.',
          code: 'RESERVATION_EXPIRED'
        });
      }
      
      // Mark reservation as being used (prevent double-use)
      reservation.status = 'executing';
      await redis.set(reservationKey, JSON.stringify(reservation), { XX: true, EX: 30 });
      
      console.log('Valid reservation found:', {
        reservationId,
        walletAddress: walletAddress.slice(0, 10) + '...',
        claimNum: reservation.claimNum,
        maxClaims: reservation.maxClaims
      });
    }

    // Get dynamic claim settings from Redis
    const claimSettings = await getClaimSettings(redis);
    const { 
      baseClaimAmount, 
      claimMultiplier, 
      cooldownHours, 
      minNeynarScore, 
      claimsEnabled 
    } = claimSettings;
    
    // Calculate actual claim amount - always 40,000 tokens
    const TOKEN_AMOUNT = String(Math.floor(baseClaimAmount * claimMultiplier));
    const COOLDOWN_SECONDS = cooldownHours * 60 * 60;
    
    // Check if claims are enabled
    if (!claimsEnabled) {
      return res.status(503).json({ error: 'Claims are currently disabled by admin' });
    }

    // SIMPLIFIED: One claim per FID per featured project - no holder benefits
    // Always maxClaims = 1
    const maxClaims = 1;

    // Check Neynar user score and account age
    const apiKey = process.env.NEYNAR_API_KEY;
    const MIN_ACCOUNT_AGE_DAYS = 2; // Minimum account age in days
    
    if (apiKey) {
      try {
        const user = await fetchUserByFid(fid, apiKey);
        if (user) {
          // Check account age first (accounts less than 2 days old cannot claim)
          // Neynar provides 'fid' which correlates to registration order, and sometimes 'timestamp'
          // We'll use the FID registration timestamp if available
          const registeredAt = user.registered_at || user.timestamp || user.profile?.timestamp;
          if (registeredAt) {
            const accountCreated = new Date(registeredAt);
            const accountAgeMs = Date.now() - accountCreated.getTime();
            const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);
            
            if (accountAgeDays < MIN_ACCOUNT_AGE_DAYS) {
              return res.status(403).json({
                error: `Your Farcaster account is too new. Accounts must be at least ${MIN_ACCOUNT_AGE_DAYS} days old to claim. Your account is ${accountAgeDays.toFixed(1)} days old.`,
                accountAgeDays: accountAgeDays,
                minAgeDays: MIN_ACCOUNT_AGE_DAYS
              });
            }
          }
          
          // Check Neynar score
          const userScore = user.experimental?.neynar_user_score;
          
          // If score exists and is below threshold, reject claim
          if (userScore !== null && userScore !== undefined) {
            if (userScore < minNeynarScore) {
              return res.status(403).json({ 
                error: `Your Neynar user score (${userScore.toFixed(2)}) is below the required threshold of ${minNeynarScore}. Only users with a score of ${minNeynarScore} or higher can claim tokens.`,
                userScore: userScore,
                minScore: minNeynarScore
              });
            }
          } else {
            // STRICT: If score is not available, block claim
            console.warn(`User ${fid} has no Neynar score available - BLOCKING claim`);
            return res.status(403).json({
              error: `Unable to verify your Neynar user score. Please try again later or contact support if this persists.`,
              code: 'SCORE_UNAVAILABLE'
            });
          }
        } else {
          // User not found in Neynar - block claim
          console.warn(`User ${fid} not found in Neynar API - BLOCKING claim`);
          return res.status(403).json({
            error: `Unable to verify your Farcaster account. Please try again later.`,
            code: 'USER_NOT_FOUND'
          });
        }
      } catch (error) {
        console.error('Error checking Neynar user score:', error);
        // STRICT: If we can't check the score, block the claim
        return res.status(403).json({
          error: `Unable to verify your Neynar user score. Please try again later.`,
          code: 'SCORE_CHECK_FAILED'
        });
      }
    }

    // Get current featured project to determine claim window
    const featuredProject = await getFeaturedProject();
    if (!featuredProject || !featuredProject.id) {
      return res.status(400).json({ error: 'No featured project available for claiming' });
    }

    const featuredProjectId = featuredProject.id;
    
    // SECURITY: featuredAt MUST be defined for expiration calculation
    if (!featuredProject.featuredAt) {
      console.error('CRITICAL: Featured project missing featuredAt timestamp!', { featuredProjectId });
      return res.status(500).json({ error: 'Featured project configuration error' });
    }
    const featuredAt = new Date(featuredProject.featuredAt);
    
    // Get rotation ID for claim keys (this only changes on explicit reset or new featured project)
    // Timer adjustments do NOT change this ID
    const rotationId = await getRotationId();
    
    // Calculate expiration: 24 hours from when project was featured
    const expirationTime = new Date(featuredAt.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    
    // Global TTL for all claim-related keys in this rotation
    const ttl = Math.max(0, Math.floor((expirationTime - now) / 1000));
    
    // Check if claim window has expired
    if (now > expirationTime) {
      return res.status(400).json({ 
        error: 'Claim window expired. New featured project must be set.',
        expired: true,
        featuredAt: featuredAt.toISOString(),
        expirationTime: expirationTime.toISOString(),
      });
    }

    // SIMPLIFIED: Always one claim per FID per featured project
    console.log('Claim attempt:', {
        fid,
        walletAddress: walletAddress?.slice(0, 10) + '...',
        maxClaims: 1
      });
    
    // SIMPLIFIED: One claim per FID per featured campaign (rotation)
    // No personal cooldown - FID can only claim once per rotation
    // New featured project = new rotation = everyone can claim again
    // Track claim by featured project ID + rotation ID + FID AND wallet
    // This prevents FID spoofing attacks - claims tracked by both FID and wallet
    // rotationId only changes on explicit reset or new featured project (not timer changes)
    const claimKey = `claim:featured:${featuredProjectId}:${rotationId}:${fid}`;
    const claimCountKey = `claim:count:${featuredProjectId}:${rotationId}:${fid}`;
    
    // SECURITY: Also track by wallet address to prevent FID spoofing (per rotation)
    const walletClaimCountKey = `claim:wallet:${featuredProjectId}:${rotationId}:${walletAddress.toLowerCase()}`;
    
    // SECURITY: Per-rotation wallet claim counter (resets for each new featured project or explicit reset)
    // This prevents exploits within a single featured rotation
    const globalWalletClaimCountKey = `claim:wallet:global:${featuredProjectId}:${rotationId}:${walletAddress.toLowerCase()}`;
    
    // SECURITY: Claim lock to prevent race conditions (multiple simultaneous claims)
    const claimLockKey = `claim:lock:${walletAddress.toLowerCase()}`;
    
    // SECURITY: Test bypass removed - no FID gets special treatment
    const isBypassEnabled = false;
    
    // maxClaims already calculated above (before cooldown check)
    
    // Log claim attempt for debugging
    console.log('Claim attempt:', {
      fid,
      walletAddress: walletAddress?.slice(0, 10) + '...',
      featuredProjectId,
      rotationId,
      maxClaims
    });
    
    // SECURITY: Acquire lock to prevent race conditions
    // Lock expires after 30 seconds in case of crash
    const lockAcquired = await redis.set(claimLockKey, '1', { NX: true, EX: 30 });
    if (!lockAcquired) {
      console.warn('SECURITY: Claim lock not acquired (concurrent request in progress):', {
        fid,
        walletAddress: walletAddress?.slice(0, 10) + '...',
      });
      return res.status(429).json({ 
        error: 'Please wait a moment and try again. Your previous claim is still processing.',
      });
    }
    
    // Wrap the rest in try/finally to ensure lock is released
    try {
    
    // SECURITY: Check per-rotation wallet claim count to enforce limit for this featured project
    const globalWalletClaimCount = await redis.incr(globalWalletClaimCountKey);
    
    // Set expiration on the counter key so it expires with the rotation
    if (ttl > 0) {
      await redis.expire(globalWalletClaimCountKey, ttl);
    }
    
    if (globalWalletClaimCount > maxClaims && !isBypassEnabled) {
      // Rollback the increment
      await redis.decr(globalWalletClaimCountKey);
      // Release lock before returning
      await redis.del(claimLockKey);
      console.warn('SECURITY: Wallet claim limit exceeded for this rotation:', {
        fid,
        walletAddress: walletAddress?.slice(0, 10) + '...',
        globalWalletClaimCount,
        maxClaims,
        featuredProjectId,
        rotationId,
      });
      return res.status(400).json({ 
        error: `This wallet has already claimed the maximum allowed (${maxClaims}) for this featured project.`,
        featuredProjectId,
        claimCount: globalWalletClaimCount - 1,
        globalWalletClaimCount: globalWalletClaimCount - 1,
        maxClaims,
      });
    }
    
    // SECURITY: Check WALLET claim count for this featured rotation
    // This ensures a wallet can't claim unlimited times per project by cycling through FIDs
    const walletClaimCount = await redis.incr(walletClaimCountKey);
    
    if (walletClaimCount > maxClaims && !isBypassEnabled) {
      // Rollback the increments
      await redis.decr(walletClaimCountKey);
      await redis.decr(globalWalletClaimCountKey);
      // Release lock before returning
      await redis.del(claimLockKey);
      console.warn('SECURITY: Wallet claim limit exceeded for rotation (possible FID spoofing attempt):', {
        fid,
        walletAddress: walletAddress?.slice(0, 10) + '...',
        walletClaimCount,
        globalWalletClaimCount,
        maxClaims,
        featuredProjectId,
        rotationId
      });
      return res.status(400).json({ 
        error: 'This wallet has already claimed the maximum allowed for this featured project',
        featuredProjectId,
        claimCount: walletClaimCount - 1,
        walletClaimCount: walletClaimCount - 1,
        globalWalletClaimCount: globalWalletClaimCount - 1,
        maxClaims,
      });
    }
    
    // ATOMIC CHECK: Check FID claim count for this featured rotation
    // Use INCR to atomically increment and get the new value
    const newClaimCount = await redis.incr(claimCountKey);
    
    console.log('Claim count check:', {
      fid,
      walletAddress: walletAddress?.slice(0, 10) + '...',
      newClaimCount,
      walletClaimCount,
      globalWalletClaimCount,
      maxClaims,
      isBypassEnabled,
      featuredProjectId,
      rotationId,
      claimCountKey,
      walletClaimCountKey,
      globalWalletClaimCountKey,
      willAllow: newClaimCount <= maxClaims || isBypassEnabled
    });
    
    // If FID claim count exceeds max, decrement both counters and reject
    if (newClaimCount > maxClaims && !isBypassEnabled) {
      // Rollback all increments
      await redis.decr(claimCountKey);
      await redis.decr(walletClaimCountKey);
      await redis.decr(globalWalletClaimCountKey);
      // Release lock before returning
      await redis.del(claimLockKey);
      console.warn('Claim rejected - FID exceeded max:', {
        fid,
        walletAddress: walletAddress?.slice(0, 10) + '...',
        newClaimCount,
        maxClaims,
        featuredProjectId,
        rotationId,
        claimCountKey
      });
      return res.status(400).json({ 
        error: 'Already claimed for this featured project rotation',
        featuredProjectId,
        featuredAt: featuredAt.toISOString(),
        expirationTime: expirationTime.toISOString(),
        claimCount: newClaimCount - 1,
        maxClaims,
      });
    }
    
    // Additional safety: Log if someone is claiming more than expected
    if (newClaimCount > maxClaims) {
      console.error('CRITICAL: Claim count exceeded maxClaims but was allowed!', {
        fid,
        walletAddress: walletAddress?.slice(0, 10) + '...',
        newClaimCount,
        walletClaimCount,
        globalWalletClaimCount,
        maxClaims,
        isBypassEnabled,
        featuredProjectId,
        rotationId
      });
    }
    
    // Set expiration on all claim count keys
    await redis.expire(claimCountKey, ttl);
    await redis.expire(walletClaimCountKey, ttl);
    await redis.expire(globalWalletClaimCountKey, ttl);

    // If no token contract configured, return token details for client-side transaction
    if (!TOKEN_CONTRACT || !TREASURY_PRIVATE_KEY) {
      console.error('Token configuration missing:', {
        hasTokenContract: !!TOKEN_CONTRACT,
        hasTreasuryKey: !!TREASURY_PRIVATE_KEY,
        tokenContract: TOKEN_CONTRACT || 'NOT SET',
        treasuryKeyPrefix: TREASURY_PRIVATE_KEY ? `${TREASURY_PRIVATE_KEY.slice(0, 10)}...` : 'NOT SET',
      });
      return res.status(200).json({
        success: true,
        tokenContract: TOKEN_CONTRACT || null,
        amount: TOKEN_AMOUNT,
        decimals: TOKEN_DECIMALS,
        message: 'Token contract not configured. Please configure CLAIM_TOKEN_CONTRACT and TREASURY_PRIVATE_KEY environment variables.',
        expirationTime: expirationTime.toISOString(),
        featuredProjectId,
      });
    }

    // If user tx is required, verify provided txHash (unless bypass)
    if (REQUIRE_USER_TX && !isBypassEnabled) {
      if (!txHash) {
        return res.status(400).json({ error: 'Transaction hash required for claiming' });
      }

      // PREVENT REPLAY ATTACK: Atomically check AND lock this txHash using SETNX
      // This prevents race conditions where multiple requests check before any marks as used
      const txHashKey = `claim:txhash:${txHash.toLowerCase()}`;
      const txHashLockResult = await redis.set(txHashKey, 'pending', { NX: true });
      
      // If SETNX returns null, key already exists = txHash already used
      if (txHashLockResult !== 'OK') {
        return res.status(400).json({ 
          error: 'This transaction hash has already been used for a claim',
          replay: true
        });
      }
      
      // txHash is now atomically locked - will be marked as 'used' on success, or deleted on failure

      try {
        const publicClient = createPublicClient({
          chain: base,
          transport: http(),
        });

        const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
        if (!receipt || receipt.status !== 'success') {
          return res.status(400).json({ error: 'Transaction not successful or not found' });
        }

        // Basic sender/recipient validation
        const tx = await publicClient.getTransaction({ hash: txHash });
        const senderMatches = tx.from?.toLowerCase() === walletAddress.toLowerCase();
        const recipientMatches = TREASURY_ADDRESS
          ? (tx.to?.toLowerCase() === TREASURY_ADDRESS.toLowerCase())
          : !!tx.to;

        if (!senderMatches) {
          return res.status(400).json({ error: 'Transaction sender does not match claiming wallet' });
        }

        if (!recipientMatches) {
          return res.status(400).json({ error: 'Transaction not sent to treasury address' });
        }

        // Optional: ensure data contains "claim" marker if present
        if (tx.input && tx.input !== '0x') {
          const inputLower = tx.input.toLowerCase();
          if (!inputLower.includes('636c61696d')) { // hex for 'claim'
            console.warn('Claim tx input missing claim marker');
          }
        }
      } catch (verifyError) {
        console.error('Error verifying user transaction:', verifyError);
        return res.status(400).json({ error: 'Failed to verify user transaction' });
      }
    }

    // Send tokens from treasury wallet
    // Declare variables outside try block for rollback access
    let bonusTokenHash = null;
    let userBonusTokenKey = null;
    let bonusTokenCountKey = null;
    
    try {
      // Validate private key format
      if (!TREASURY_PRIVATE_KEY || !TREASURY_PRIVATE_KEY.startsWith('0x')) {
        return res.status(500).json({ 
          error: 'Treasury private key not configured properly. Must start with 0x' 
        });
      }

      // Validate token contract address format
      if (!TOKEN_CONTRACT || !TOKEN_CONTRACT.startsWith('0x') || TOKEN_CONTRACT.length !== 42) {
        return res.status(500).json({ 
          error: 'Invalid token contract address. Must be a valid Ethereum address (0x followed by 40 hex characters)',
          provided: TOKEN_CONTRACT || 'NOT SET'
        });
      }
      
      const account = privateKeyToAccount(TREASURY_PRIVATE_KEY);
      
      // Verify treasury address matches if provided
      if (TREASURY_ADDRESS && account.address.toLowerCase() !== TREASURY_ADDRESS.toLowerCase()) {
        console.warn(`Treasury address mismatch: expected ${TREASURY_ADDRESS}, got ${account.address}`);
      }
      
      const walletClient = createWalletClient({
        account,
        chain: base,
        transport: http(),
      });

      // Get configurable bonus token config from admin panel
      let bonusTokenConfig = null;
      try {
        const bonusConfigJson = await redis.get(BONUS_TOKEN_CONFIG_KEY);
        if (bonusConfigJson) {
          bonusTokenConfig = JSON.parse(bonusConfigJson);
        }
      } catch (error) {
        console.error('Error reading bonus token config:', error);
      }

      // Check configurable bonus token (ALL bonus tokens configured via admin panel now)
      let bonusTokenAvailable = false;
      
      if (bonusTokenConfig && bonusTokenConfig.enabled && bonusTokenConfig.contractAddress) {
        userBonusTokenKey = `bonus:user:${walletAddress.toLowerCase()}:${bonusTokenConfig.contractAddress.toLowerCase()}`;
        bonusTokenCountKey = `bonus:count:given:${bonusTokenConfig.contractAddress.toLowerCase()}`;
        
        // Atomic check - only mark user if they haven't received this bonus token yet
        const userBonusLockResult = await redis.set(userBonusTokenKey, '1', { NX: true });
        const userCanGetBonus = userBonusLockResult === 'OK';
        
        const bonusCountGiven = parseInt(await redis.get(bonusTokenCountKey) || '0');
        const bonusGlobalAvailable = bonusCountGiven < parseInt(bonusTokenConfig.maxSupply || '0');
        
        bonusTokenAvailable = bonusGlobalAvailable && userCanGetBonus;
        
        console.log('Bonus token check:', {
          token: bonusTokenConfig.tokenName,
          contract: bonusTokenConfig.contractAddress,
          userCanGetBonus,
          bonusCountGiven,
          maxSupply: bonusTokenConfig.maxSupply,
          available: bonusTokenAvailable,
        });
      }
      
      // SEEN amount is ALWAYS 40,000 per claim - one claim per FID per featured project
      // Bonus token (if configured): 1 per person, once only, while supply lasts
      const seenAmount = TOKEN_AMOUNT; // Always 40,000
      const seenAmountWei = parseUnits(seenAmount, TOKEN_DECIMALS);
      
      console.log('Sending tokens:', {
        bonusTokenAvailable,
        bonusTokenConfig: bonusTokenConfig ? {
          enabled: bonusTokenConfig.enabled,
          contract: bonusTokenConfig.contractAddress,
          amount: bonusTokenConfig.amount,
          maxSupply: bonusTokenConfig.maxSupply,
        } : null,
        seenContract: TOKEN_CONTRACT,
        seenAmount,
        bonusContract: bonusTokenAvailable ? bonusTokenConfig?.contractAddress : null,
        bonusAmount: bonusTokenAvailable ? bonusTokenConfig?.amount : null,
        to: walletAddress,
        from: account.address,
      });

      // Verify featured project hasn't changed during claim process (prevent multi-claim exploit)
      const currentFeaturedProject = await getFeaturedProject();
      if (!currentFeaturedProject || currentFeaturedProject.id !== featuredProjectId) {
        // Featured project changed - rollback and reject
        await redis.decr(claimCountKey);
        await redis.decr(walletClaimCountKey);
        await redis.decr(globalWalletClaimCountKey);
        if (userBonusTokenKey) {
          await redis.del(userBonusTokenKey);
        }
        // Release txHash lock so user can retry
        if (txHash) {
          await redis.del(`claim:txhash:${txHash.toLowerCase()}`);
        }
        // Release claim lock before returning
        await redis.del(claimLockKey);
        return res.status(400).json({ 
          error: 'Featured project changed during claim. Please try again.',
          featuredProjectChanged: true
        });
      }
      
      // Send SEEN tokens first
      // Checksum addresses to ensure proper format
      const checksummedTokenContract = getAddress(TOKEN_CONTRACT);
      const checksummedRecipientForSeen = getAddress(walletAddress);
      
      console.log('Sending SEEN tokens:', {
        tokenContract: checksummedTokenContract,
        recipient: checksummedRecipientForSeen,
        amount: TOKEN_AMOUNT,
        amountWei: seenAmountWei.toString(),
      });
      
      const seenHash = await walletClient.writeContract({
        address: checksummedTokenContract,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [checksummedRecipientForSeen, seenAmountWei],
      });

      // Send bonus token if available (configured via admin panel)
      if (bonusTokenAvailable && bonusTokenConfig) {
        try {
          const bonusAmountWei = parseUnits(bonusTokenConfig.amount, parseInt(bonusTokenConfig.decimals || '18'));
          const checksummedBonusContract = getAddress(bonusTokenConfig.contractAddress);
          console.log('Sending bonus token:', {
            token: bonusTokenConfig.tokenName,
            contract: checksummedBonusContract,
            amount: bonusTokenConfig.amount,
            recipient: walletAddress,
          });
          bonusTokenHash = await walletClient.writeContract({
            address: checksummedBonusContract,
            abi: erc20Abi,
            functionName: 'transfer',
            args: [getAddress(walletAddress), bonusAmountWei],
          });
          console.log('Bonus token sent successfully:', bonusTokenHash);
          
          // Increment global bonus token count
          await redis.incr(bonusTokenCountKey);
        } catch (bonusError) {
          console.error('Bonus token transfer FAILED:', bonusError.message);
          console.error('Bonus token error details:', {
            errorName: bonusError.name,
            errorCause: bonusError.cause?.message || bonusError.cause,
            contractAddress: bonusTokenConfig.contractAddress,
            recipientAddress: walletAddress,
            amount: bonusTokenConfig.amount,
          });
          // Release the user lock since transfer failed
          if (userBonusTokenKey) {
            await redis.del(userBonusTokenKey);
          }
          // DON'T fail the claim - SEEN was already sent successfully
        }
      } else if (userBonusTokenKey && bonusTokenConfig && 
                 await redis.get(userBonusTokenKey) === '1' && 
                 parseInt(await redis.get(bonusTokenCountKey) || '0') >= parseInt(bonusTokenConfig.maxSupply || '0')) {
        // Race condition: user got lock but bonus token ran out - release the lock
        await redis.del(userBonusTokenKey);
      }

      // Use SEEN hash as primary hash (for backward compatibility)
      const hash = seenHash;

      // Calculate TTL: time until expiration (expires when featured project changes)
      const ttl = Math.max(0, Math.floor((expirationTime - now) / 1000));
      
      // Record the claim with transaction hash (expires when featured project changes)
      await redis.setEx(claimKey, ttl, newClaimCount.toString());
      // If txHash was provided (user transaction), use that, otherwise use treasury tx hash
      const userTxHash = txHash || hash;
      await redis.setEx(`claim:tx:${featuredProjectId}:${rotationId}:${fid}:${newClaimCount}`, ttl, userTxHash);
      
      // Mark txHash as permanently used (was locked as 'pending' earlier, now mark as 'used')
      // This is persistent and never expires to prevent replay attacks
      if (txHash) {
        await redis.set(`claim:txhash:${txHash.toLowerCase()}`, 'used');
      }
      
      // SIMPLIFIED: No personal cooldown - FID can only claim once per rotation
      // New featured project = new rotation = everyone can claim again

      // Track a click when user successfully claims (they opened the miniapp to claim)
      try {
        // Use window key based on rotationId for featured projects (stable across timer changes)
        let windowKey;
        if (featuredProject?.rotationId) {
          windowKey = featuredProject.rotationId;
        } else {
          // Fallback to calendar date if no rotationId
          windowKey = new Date().toISOString().split('T')[0];
        }
        
        const clickKey = `clicks:project:${featuredProjectId}:${windowKey}`;
        await redis.incr(clickKey);
        
        // Set expiration: 48 hours for featured (to cover full 24h window + buffer), 2 days for others
        const expiration = featuredProject?.rotationId ? 48 * 60 * 60 : 2 * 24 * 60 * 60;
        await redis.expire(clickKey, expiration);
      } catch (clickError) {
        console.error('Error tracking click for claim:', clickError);
        // Don't fail the claim if click tracking fails
      }

    // Build success message
    let successMessage = 'Tokens sent successfully';
    if (bonusTokenAvailable && bonusTokenConfig) {
      const bonusName = bonusTokenConfig.tokenName || 'Bonus Token';
      successMessage = `Tokens sent successfully! Bonus: ${bonusTokenConfig.amount} ${bonusName} + ${seenAmount} $SEEN`;
    }

    // Release lock before returning success
    await redis.del(claimLockKey);
    
    // Clear reservation if one was used (claim completed successfully)
    if (reservationKey) {
      await redis.del(reservationKey);
    }
    
    // Calculate bonus token remaining
    let bonusTokenRemaining = 0;
    if (bonusTokenConfig && bonusTokenCountKey) {
      const bonusCountGiven = parseInt(await redis.get(bonusTokenCountKey) || '0');
      bonusTokenRemaining = Math.max(0, parseInt(bonusTokenConfig.maxSupply || '0') - bonusCountGiven);
    }
    
    return res.status(200).json({
      success: true,
      message: successMessage,
      expirationTime: expirationTime.toISOString(),
      featuredProjectId,
      txHash: txHash || hash, // Return user's txHash if provided, otherwise treasury tx hash
      treasuryTxHash: hash, // Also return treasury transaction hash
      bonusTokenTxHash: bonusTokenHash, // Bonus token transaction hash if sent
      amount: seenAmount, // Actual SEEN amount sent
      bonusTokenIncluded: bonusTokenAvailable, // Whether bonus token was included
      bonusTokenName: bonusTokenConfig?.tokenName || null, // Name of bonus token if sent
      bonusTokenAmount: bonusTokenConfig?.amount || null, // Amount of bonus token sent
      bonusTokenRemaining, // Remaining bonus tokens
      claimCount: newClaimCount,
      maxClaims,
      canClaimAgain: newClaimCount < maxClaims,
    });
    } catch (txError) {
      console.error('Error sending tokens:', {
        error: txError,
        message: txError.message,
        cause: txError.cause,
        contract: TOKEN_CONTRACT,
        amount: TOKEN_AMOUNT,
        decimals: TOKEN_DECIMALS,
        recipient: walletAddress,
      });

      // ROLLBACK: If token sending failed, rollback all claim count increments
      try {
        await redis.decr(claimCountKey);
        await redis.decr(walletClaimCountKey); // Also rollback wallet claim count
        await redis.decr(globalWalletClaimCountKey); // Also rollback global wallet claim count
        // Also rollback bonus token user lock if we set it
        if (userBonusTokenKey) {
          await redis.del(userBonusTokenKey);
        }
        // Release txHash lock so user can retry with same txHash
        if (txHash) {
          await redis.del(`claim:txhash:${txHash.toLowerCase()}`);
        }
        // If we incremented global bonus token count, rollback (but we only increment after successful send, so this shouldn't happen)
      } catch (rollbackError) {
        console.error('Error rolling back claim:', rollbackError);
      }

      // Provide more specific error messages
      let errorMessage = 'Failed to send tokens';
      let errorDetails = txError.message;

      // Log full error details for debugging
      console.error('Token transfer error details:', {
        errorMessage: txError.message,
        errorName: txError.name,
        errorCause: txError.cause?.message || txError.cause,
        tokenContract: TOKEN_CONTRACT,
        recipient: walletAddress,
        amount: TOKEN_AMOUNT,
        amountWei: seenAmountWei?.toString(),
        treasuryAddress: account?.address,
      });

      if (txError.message?.includes('insufficient funds') || txError.message?.includes('balance')) {
        errorMessage = 'Insufficient token balance in treasury wallet';
        errorDetails = 'The treasury wallet does not have enough tokens to send. Please add tokens to the treasury wallet.';
      } else if (txError.message?.includes('execution reverted') || txError.message?.includes('revert')) {
        errorMessage = 'Token transfer failed - contract execution reverted';
        errorDetails = 'The token contract rejected the transfer. This could mean: (1) Invalid contract address, (2) Contract is not an ERC20 token, (3) Contract is paused, or (4) Transfer function failed.';
      } else if (txError.message?.includes('invalid address') || txError.message?.includes('address')) {
        errorMessage = 'Invalid contract address';
        errorDetails = `The token contract address (${TOKEN_CONTRACT}) is not valid or the contract does not exist on Base network.`;
      }

      // Release lock before returning error
      await redis.del(claimLockKey);
      
      return res.status(500).json({ 
        error: errorMessage,
        details: errorDetails,
        contract: TOKEN_CONTRACT,
        troubleshooting: {
          checkContract: 'Verify the contract address is correct and deployed on Base network',
          checkBalance: 'Verify the treasury wallet has enough tokens',
          checkContractType: 'Verify the contract is a valid ERC20 token with transfer() function',
          checkNetwork: 'Verify the contract is on Base network (not Ethereum mainnet)',
        }
      });
    } finally {
      // ALWAYS release the lock when done (in case any code path missed it)
      try {
        await redis.del(claimLockKey);
      } catch (lockError) {
        console.warn('Error releasing claim lock:', lockError);
      }
    }
  } catch (error) {
    console.error('Error processing claim:', error);
    return res.status(500).json({ error: 'Failed to process claim' });
  }
}