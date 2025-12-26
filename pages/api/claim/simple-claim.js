// SIMPLE CLAIM SYSTEM - One claim per FID per featured project
// No complex rotation logic, no rate limits, just simple FID tracking
// WITH Neynar validation for security
// REQUIRES user to sign a transaction first (for miniapp rankings)
// SECURITY: Also tracks claims per wallet to prevent multi-FID exploit

import { getRedisClient } from '../../../lib/redis';
import { getFeaturedProject } from '../../../lib/projects';
import { fetchUserByFid, verifyWalletOwnership, verifyCustodyWallet } from '../../../lib/neynar';
import { trackMetric, METRIC_TYPES } from '../../../lib/analytics';
import { checkFidNotBlocked } from '../../../lib/fid-blocking';
import { parseUnits, getAddress, createWalletClient, createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { erc20Abi } from 'viem';

// Token configuration
const TOKEN_CONTRACT = process.env.CLAIM_TOKEN_CONTRACT;
const TOKEN_DECIMALS = parseInt(process.env.CLAIM_TOKEN_DECIMALS || '18');
const DEFAULT_TOKEN_AMOUNT = '60000'; // Default: 60,000 GS per claim
const TREASURY_PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY;
const CLAIM_AMOUNT_KEY = 'config:claim:amount';
const CLAIMS_DISABLED_KEY = 'config:claims:disabled';

// Security configuration - INCREASED to combat exploits
const MIN_NEYNAR_SCORE = 0.6; // Minimum Neynar user score
const MIN_ACCOUNT_AGE_DAYS = 14; // Minimum Farcaster account age in days (increased to 14)
const MAX_CLAIMS_PER_WALLET = 1; // SECURITY: Maximum claims per wallet address per rotation
const MIN_FOLLOWERS = 50; // Minimum follower count (increased to 50)
const REQUIRE_CUSTODY_WALLET = false; // Disabled - too restrictive for most users
const REQUIRE_POWER_BADGE = false; // Optional: Require Farcaster power badge

// Helper function to get current claim amount from Redis
async function getClaimAmount(redis) {
  const amount = await redis.get(CLAIM_AMOUNT_KEY);
  return amount || DEFAULT_TOKEN_AMOUNT;
}

export default async function handler(req, res) {
  // GET = check status, POST = claim
  const redis = await getRedisClient();
  if (!redis) {
    return res.status(500).json({ error: 'Redis unavailable' });
  }

  // Get current claim amount
  const TOKEN_AMOUNT = await getClaimAmount(redis);

  // Get featured project
  const featured = await getFeaturedProject();
  if (!featured?.id) {
    return res.status(400).json({ error: 'No featured project', canClaim: false });
  }

  // Simple key: FID + rotation ID (changes when project is re-featured)
  const getClaimKey = (fid) => `simple:claim:${featured.rotationId}:${fid}`;
  
  // SECURITY: Wallet claim key - prevents multi-FID exploit (same wallet, multiple FIDs) per rotation
  const getWalletClaimKey = (wallet) => `simple:claim:wallet:${featured.rotationId}:${wallet.toLowerCase()}`;
  
  // SECURITY: PERMANENT wallet-to-FID binding - a wallet can only ever be used by ONE FID
  // This prevents creating new FIDs and using the same wallet
  const getWalletOwnerKey = (wallet) => `wallet:owner:${wallet.toLowerCase()}`;
  
  // SECURITY: PERMANENT FID-to-wallet binding - an FID can only ever claim to ONE wallet
  // This prevents adding new wallets to an existing FID
  const getFidWalletKey = (fid) => `fid:wallet:${fid}`;

  // ========== GET = CHECK STATUS ==========
  if (req.method === 'GET') {
    const { fid, wallet } = req.query;

    if (!fid) {
      return res.status(200).json({ canClaim: false, error: 'No FID' });
    }

    // Check if claims are globally disabled
    const disabledValue = await redis.get(CLAIMS_DISABLED_KEY);
    const claimsDisabled = disabledValue === 'true';

    // Check if FID is blocked from claims
    const BLOCKED_FIDS_KEY = 'admin:blocked:fids';
    const blockedFidsJson = await redis.get(BLOCKED_FIDS_KEY);
    const blockedFids = blockedFidsJson ? JSON.parse(blockedFidsJson) : [];
    const fidNum = parseInt(fid);
    const isBlocked = blockedFids.includes(fidNum);

    const claimKey = getClaimKey(fid);
    const hasClaimed = await redis.get(claimKey);
    
    // SECURITY: Check if wallet has already claimed (multi-FID exploit prevention)
    let walletAlreadyClaimed = false;
    let walletClaimInfo = null;
    let walletOwnedByAnotherFid = false;
    let fidBoundToAnotherWallet = false;
    let boundWallet = null;
    
    if (wallet) {
      const walletClaimKey = getWalletClaimKey(wallet);
      const walletData = await redis.get(walletClaimKey);
      if (walletData) {
        walletAlreadyClaimed = true;
        walletClaimInfo = JSON.parse(walletData);
      }
      
      // Check permanent wallet-to-FID binding
      const walletOwnerKey = getWalletOwnerKey(wallet);
      const existingOwner = await redis.get(walletOwnerKey);
      if (existingOwner && parseInt(existingOwner) !== fidNum) {
        walletOwnedByAnotherFid = true;
      }
    }
    
    // Check permanent FID-to-wallet binding
    const fidWalletKey = getFidWalletKey(fid);
    const existingFidWallet = await redis.get(fidWalletKey);
    if (existingFidWallet) {
      boundWallet = existingFidWallet;
      if (wallet && existingFidWallet.toLowerCase() !== wallet.toLowerCase()) {
        fidBoundToAnotherWallet = true;
      }
    }

    // Check Neynar score and follower count for display purposes
    let neynarScore = null;
    let neynarScoreTooLow = false;
    let followerCount = null;
    let followersTooLow = false;
    let accountAgeDays = null;
    let accountTooNew = false;
    const apiKey = process.env.NEYNAR_API_KEY;
    if (apiKey) {
      try {
        const fidNum = parseInt(fid);
        const user = await fetchUserByFid(fidNum, apiKey);
        if (user) {
          neynarScore = user.experimental?.neynar_user_score;
          if (neynarScore !== null && neynarScore !== undefined) {
            neynarScoreTooLow = neynarScore < MIN_NEYNAR_SCORE;
          }
          
          // Check follower count
          followerCount = user.follower_count || 0;
          followersTooLow = followerCount < MIN_FOLLOWERS;
          
          // Check account age
          const registeredAt = user.registered_at || user.timestamp || user.profile?.timestamp;
          if (registeredAt) {
            const accountCreated = new Date(registeredAt);
            const accountAgeMs = Date.now() - accountCreated.getTime();
            accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);
            accountTooNew = accountAgeDays < MIN_ACCOUNT_AGE_DAYS;
          }
        }
      } catch (error) {
        console.error('[SIMPLE CLAIM] Neynar check failed in GET:', error);
        // Don't fail the request, just don't return score
      }
    }

    return res.status(200).json({
      canClaim: !hasClaimed && !claimsDisabled && !neynarScoreTooLow && !isBlocked && !walletAlreadyClaimed && !followersTooLow && !accountTooNew && !walletOwnedByAnotherFid && !fidBoundToAnotherWallet,
      claimed: !!hasClaimed,
      claimedAt: hasClaimed || null,
      featuredProjectId: featured.id,
      featuredProjectName: featured.name,
      tokenAmount: TOKEN_AMOUNT,
      disabled: claimsDisabled,
      blocked: isBlocked,
      neynarScore: neynarScore,
      neynarScoreTooLow: neynarScoreTooLow,
      minNeynarScore: MIN_NEYNAR_SCORE,
      followerCount: followerCount,
      followersTooLow: followersTooLow,
      minFollowers: MIN_FOLLOWERS,
      accountAgeDays: accountAgeDays ? parseFloat(accountAgeDays.toFixed(1)) : null,
      accountTooNew: accountTooNew,
      minAccountAgeDays: MIN_ACCOUNT_AGE_DAYS,
      walletAlreadyClaimed: walletAlreadyClaimed,
      walletClaimInfo: walletClaimInfo ? { fid: walletClaimInfo.fid, timestamp: walletClaimInfo.timestamp } : null,
      walletOwnedByAnotherFid: walletOwnedByAnotherFid,
      fidBoundToAnotherWallet: fidBoundToAnotherWallet,
      boundWallet: boundWallet,
    });
  }

  // ========== POST = CLAIM ==========
  if (req.method === 'POST') {
    const { fid, walletAddress, txHash } = req.body;

    // Check if claims are globally disabled
    const disabledValue = await redis.get(CLAIMS_DISABLED_KEY);
    if (disabledValue === 'true') {
      return res.status(403).json({
        error: 'Claims are currently disabled. Please try again later.',
        success: false,
        disabled: true,
      });
    }

    // Validate inputs
    if (!fid) {
      return res.status(400).json({ error: 'FID required', success: false });
    }
    if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Valid wallet required', success: false });
    }
    if (!txHash || !txHash.match(/^0x[a-fA-F0-9]{64}$/)) {
      return res.status(400).json({ error: 'Transaction hash required - sign transaction first', success: false });
    }

    const fidNum = parseInt(fid);

    // SECURITY: Check if FID is blocked from platform
    const fidAllowed = await checkFidNotBlocked(res, fidNum);
    if (!fidAllowed) {
      return; // Response already sent by checkFidNotBlocked
    }

    // VERIFY TRANSACTION IS REAL
    let publicClient;
    try {
      publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });

      const tx = await publicClient.getTransaction({ hash: txHash });
      if (!tx) {
        return res.status(400).json({ error: 'Transaction not found on chain', success: false });
      }

      // Verify sender matches wallet
      if (tx.from.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(400).json({ 
          error: 'Transaction sender does not match wallet', 
          success: false,
          txFrom: tx.from,
          claimed: walletAddress,
        });
      }

      console.log('[SIMPLE CLAIM] Transaction verified:', { txHash, from: tx.from });
    } catch (error) {
      console.error('[SIMPLE CLAIM] Transaction verification failed:', error.message);
      return res.status(400).json({
        error: 'Could not verify transaction. Wait for confirmation and try again.',
        success: false
      });
    }
    

    // SECURITY: Check if this transaction has already been used for a claim
    // This prevents replay attacks where someone reuses a valid tx hash
    const txUsedKey = `claim:tx:used:${txHash}`;
    const txUsedData = await redis.get(txUsedKey);

    if (txUsedData) {
      const usedInfo = JSON.parse(txUsedData);
      console.warn('[SIMPLE CLAIM] Transaction replay attempt detected:', {
        txHash,
        attemptedBy: { fid: fidNum, wallet: walletAddress },
        originallyUsedBy: { fid: usedInfo.fid, wallet: usedInfo.wallet },
        usedAt: usedInfo.timestamp
      });

      return res.status(400).json({
        error: 'Transaction already used for a claim',
        success: false,
        txHash,
      });
    }


    // SECURITY: Neynar validation
    const apiKey = process.env.NEYNAR_API_KEY;

    // SECURITY FIX: Always require API key - never skip validation
    if (!apiKey) {
      console.error('[SIMPLE CLAIM] SECURITY: NEYNAR_API_KEY not configured - rejecting claim');
      return res.status(500).json({
        error: 'Score verification service unavailable. Please contact support.',
        success: false,
      });
    }

    try {
      const user = await fetchUserByFid(fidNum, apiKey);
      if (!user) {
        return res.status(403).json({
          error: 'Unable to verify your Farcaster account',
          success: false,
        });
      }

      // Check account age
      const registeredAt = user.registered_at || user.timestamp || user.profile?.timestamp;
      if (registeredAt) {
        const accountCreated = new Date(registeredAt);
        const accountAgeMs = Date.now() - accountCreated.getTime();
        const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);

        if (accountAgeDays < MIN_ACCOUNT_AGE_DAYS) {
          return res.status(403).json({
            error: `Account too new. Must be ${MIN_ACCOUNT_AGE_DAYS}+ days old (yours: ${accountAgeDays.toFixed(1)} days)`,
            success: false,
            accountAgeDays: accountAgeDays.toFixed(1),
            requiredDays: MIN_ACCOUNT_AGE_DAYS,
          });
        }
      }

      // Check Neynar score
      const userScore = user.experimental?.neynar_user_score;
      if (userScore === null || userScore === undefined) {
        return res.status(403).json({
          error: 'Neynar score unavailable. Please try again later.',
          success: false,
        });
      }

      if (userScore < MIN_NEYNAR_SCORE) {
        return res.status(403).json({
          error: `Neynar score too low (${userScore.toFixed(2)}). Minimum: ${MIN_NEYNAR_SCORE}`,
          success: false,
          userScore,
          minScore: MIN_NEYNAR_SCORE,
        });
      }
      
      // SECURITY: Check follower count to prevent bot accounts
      const followerCount = user.follower_count || 0;
      if (followerCount < MIN_FOLLOWERS) {
        console.warn('[SIMPLE CLAIM] Low follower count rejection:', {
          fid: fidNum,
          followers: followerCount,
          required: MIN_FOLLOWERS,
        });
        return res.status(403).json({
          error: `Not enough followers (${followerCount}). Minimum: ${MIN_FOLLOWERS} followers required.`,
          success: false,
          followerCount,
          minFollowers: MIN_FOLLOWERS,
        });
      }
    } catch (error) {
      console.error('[SIMPLE CLAIM] Neynar validation failed:', error);
      return res.status(403).json({
        error: 'Unable to verify your account. Please try again.',
        success: false,
      });
    }

    // SECURITY FIX: Verify wallet is CUSTODY wallet (not just any verified wallet)
    // This prevents the "fresh wallet" exploit where users add new wallets to old accounts
    if (REQUIRE_CUSTODY_WALLET) {
      const custodyCheck = await verifyCustodyWallet(fidNum, walletAddress, apiKey);
      
      if (!custodyCheck.isCustody) {
        console.warn('[SIMPLE CLAIM] Non-custody wallet rejection:', {
          fid: fidNum,
          walletAddress,
          custodyAddress: custodyCheck.custodyAddress,
        });
        return res.status(403).json({
          error: 'Only your Farcaster custody wallet can claim. You must use the wallet that was created with your Farcaster account.',
          success: false,
          yourWallet: walletAddress,
          requiredWallet: custodyCheck.custodyAddress,
          tip: 'Your custody wallet is the one shown in your Farcaster settings, not a connected wallet.',
        });
      }
      
      // Optional: Require power badge for extra security
      if (REQUIRE_POWER_BADGE && !custodyCheck.hasPowerBadge) {
        console.warn('[SIMPLE CLAIM] No power badge rejection:', {
          fid: fidNum,
          hasPowerBadge: custodyCheck.hasPowerBadge,
        });
        return res.status(403).json({
          error: 'Farcaster Power Badge required to claim. Build your reputation on Farcaster first.',
          success: false,
          hasPowerBadge: false,
        });
      }
    } else {
      // Fallback to regular wallet verification if custody check disabled
      const isWalletVerified = await verifyWalletOwnership(fidNum, walletAddress, apiKey);
      if (!isWalletVerified) {
        console.warn('[SIMPLE CLAIM] FID spoofing attempt detected:', {
          claimedFid: fidNum,
          walletAddress,
        });
        return res.status(403).json({
          error: 'Wallet address not verified for this Farcaster account. Connect your wallet to your Farcaster profile first.',
          success: false,
        });
      }
    }

    const claimKey = getClaimKey(fidNum);
    const walletClaimKey = getWalletClaimKey(walletAddress);
    const walletOwnerKey = getWalletOwnerKey(walletAddress);
    const fidWalletKey = getFidWalletKey(fidNum);

    // SECURITY: Check PERMANENT wallet-to-FID binding
    // A wallet can only EVER be used by ONE FID across ALL rotations
    const existingWalletOwner = await redis.get(walletOwnerKey);
    if (existingWalletOwner) {
      const ownerFid = parseInt(existingWalletOwner);
      if (ownerFid !== fidNum) {
        console.warn('[SIMPLE CLAIM] SECURITY: Wallet belongs to different FID:', {
          attemptingFid: fidNum,
          walletAddress,
          ownerFid,
        });
        return res.status(403).json({
          error: 'This wallet is permanently linked to a different Farcaster account. Each wallet can only be used by one account.',
          success: false,
          walletOwnedByAnotherFid: true,
        });
      }
    }
    
    // SECURITY: Check PERMANENT FID-to-wallet binding  
    // An FID can only EVER claim to ONE wallet across ALL rotations
    const existingFidWallet = await redis.get(fidWalletKey);
    if (existingFidWallet) {
      const boundWallet = existingFidWallet.toLowerCase();
      if (boundWallet !== walletAddress.toLowerCase()) {
        console.warn('[SIMPLE CLAIM] SECURITY: FID bound to different wallet:', {
          fid: fidNum,
          attemptingWallet: walletAddress,
          boundWallet: existingFidWallet,
        });
        return res.status(403).json({
          error: 'Your Farcaster account is permanently linked to a different wallet. You must use the same wallet you used before.',
          success: false,
          fidBoundToAnotherWallet: true,
          boundWallet: existingFidWallet,
        });
      }
    }

    // SECURITY: Check if wallet has already received claims in this rotation (multi-FID exploit prevention)
    const walletClaimData = await redis.get(walletClaimKey);
    if (walletClaimData) {
      const walletClaimInfo = JSON.parse(walletClaimData);
      console.warn('[SIMPLE CLAIM] SECURITY: Multi-FID exploit attempt detected:', {
        attemptingFid: fidNum,
        walletAddress,
        previousClaim: walletClaimInfo,
      });
      return res.status(403).json({
        error: 'This wallet has already received a claim for this featured project. One claim per wallet allowed.',
        success: false,
        walletAlreadyClaimed: true,
        previousFid: walletClaimInfo.fid,
      });
    }

    // Check if already claimed (atomic)
    const alreadyClaimed = await redis.get(claimKey);
    if (alreadyClaimed) {
      return res.status(400).json({ 
        error: 'Already claimed for this featured project',
        success: false,
        claimed: true,
        claimedAt: alreadyClaimed
      });
    }

    // Try to set claim (atomic - prevents race conditions)
    const timestamp = new Date().toISOString();
    const setResult = await redis.set(claimKey, timestamp, { NX: true });
    
    if (!setResult) {
      // Someone else claimed in between
      return res.status(400).json({ 
        error: 'Already claimed (race condition)',
        success: false,
        claimed: true
      });
    }

    // Send tokens from treasury (user signed 0 ETH tx for rankings)
    if (!TOKEN_CONTRACT) {
      return res.status(500).json({
        success: false,
        error: 'Token contract not configured',
      });
    }

    const TREASURY_PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY;
    if (!TREASURY_PRIVATE_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Treasury private key not configured',
      });
    }

    try {
      const account = privateKeyToAccount(TREASURY_PRIVATE_KEY);
      const walletClient = createWalletClient({
        account,
        chain: base,
        transport: http(),
      });

      const amountWei = parseUnits(TOKEN_AMOUNT, TOKEN_DECIMALS);
      const checksummedContract = getAddress(TOKEN_CONTRACT);
      const checksummedRecipient = getAddress(walletAddress);

      console.log('[SIMPLE CLAIM] Sending tokens:', {
        fid: fidNum,
        to: checksummedRecipient,
        amount: TOKEN_AMOUNT,
        contract: checksummedContract,
      });

      // Treasury sends tokens to user
      const txHash = await walletClient.writeContract({
        address: checksummedContract,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [checksummedRecipient, amountWei],
      });

      console.log('[SIMPLE CLAIM] Success:', { fid: fidNum, txHash });

      // Track analytics
      await trackMetric(METRIC_TYPES.CLAIM_SUCCESS, {
        fid: fidNum,
        amount: TOKEN_AMOUNT,
        projectId: featured.id,
      }, parseFloat(TOKEN_AMOUNT));

      // SECURITY: Mark transaction as used to prevent replay attacks
      // Store for 1 year (longer than any reasonable claim window)
      const txUsedData = {
        fid: fidNum,
        wallet: walletAddress,
        timestamp: Date.now(),
        projectId: featured.id,
        amount: TOKEN_AMOUNT,
      };
      await redis.set(txUsedKey, JSON.stringify(txUsedData), {
        EX: 365 * 24 * 60 * 60 // 1 year
      });

      console.log('[SIMPLE CLAIM] Transaction marked as used:', { txHash, fid: fidNum });
      
      // SECURITY: Record wallet claim to prevent multi-FID exploit (per rotation)
      const walletClaimData = {
        fid: fidNum,
        timestamp: Date.now(),
        rotationId: featured.rotationId,
        amount: TOKEN_AMOUNT,
      };
      await redis.set(walletClaimKey, JSON.stringify(walletClaimData), {
        EX: 30 * 24 * 60 * 60 // 30 days (longer than any rotation)
      });
      
      // SECURITY: Set PERMANENT wallet-to-FID binding (if not already set)
      // This wallet can NEVER be used by a different FID
      if (!existingWalletOwner) {
        await redis.set(walletOwnerKey, fidNum.toString());
        console.log('[SIMPLE CLAIM] Wallet permanently bound to FID:', { wallet: walletAddress, fid: fidNum });
      }
      
      // SECURITY: Set PERMANENT FID-to-wallet binding (if not already set)
      // This FID can NEVER claim to a different wallet
      if (!existingFidWallet) {
        await redis.set(fidWalletKey, walletAddress.toLowerCase());
        console.log('[SIMPLE CLAIM] FID permanently bound to wallet:', { fid: fidNum, wallet: walletAddress });
      }
      
      console.log('[SIMPLE CLAIM] Wallet claim recorded:', { wallet: walletAddress, fid: fidNum });

      return res.status(200).json({
        success: true,
        message: `Sent ${TOKEN_AMOUNT} tokens!`,
        txHash,
        amount: TOKEN_AMOUNT,
        featuredProjectId: featured.id,
      });

    } catch (error) {
      console.error('[SIMPLE CLAIM] Token transfer failed:', error.message);

      // Rollback the claim marker so they can try again
      await redis.del(claimKey);

      return res.status(500).json({
        success: false,
        error: 'Token transfer failed: ' + error.message,
        canRetry: true,
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

