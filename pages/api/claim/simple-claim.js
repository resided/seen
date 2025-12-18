// SIMPLE CLAIM SYSTEM - One claim per FID per featured project
// No complex rotation logic, no rate limits, just simple FID tracking
// WITH Neynar validation for security

import { getRedisClient } from '../../../lib/redis';
import { getFeaturedProject } from '../../../lib/projects';
import { fetchUserByFid } from '../../../lib/neynar';
import { createWalletClient, createPublicClient, http, parseUnits, getAddress } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { erc20Abi } from 'viem';

// Token configuration
const TOKEN_CONTRACT = process.env.CLAIM_TOKEN_CONTRACT;
const TOKEN_DECIMALS = parseInt(process.env.CLAIM_TOKEN_DECIMALS || '18');
const TOKEN_AMOUNT = '40000'; // 40,000 SEEN per claim
const TREASURY_PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY;

// Security configuration
const MIN_NEYNAR_SCORE = 0.6; // Minimum Neynar user score
const MIN_ACCOUNT_AGE_DAYS = 2; // Minimum account age in days

export default async function handler(req, res) {
  // GET = check status, POST = claim
  const redis = await getRedisClient();
  if (!redis) {
    return res.status(500).json({ error: 'Redis unavailable' });
  }

  // Get featured project
  const featured = await getFeaturedProject();
  if (!featured?.id) {
    return res.status(400).json({ error: 'No featured project', canClaim: false });
  }

  // Simple key: just FID + featured project ID
  const getClaimKey = (fid) => `simple:claim:${featured.id}:${fid}`;

  // ========== GET = CHECK STATUS ==========
  if (req.method === 'GET') {
    const { fid, wallet } = req.query;
    
    if (!fid) {
      return res.status(200).json({ canClaim: false, error: 'No FID' });
    }

    const claimKey = getClaimKey(fid);
    const hasClaimed = await redis.get(claimKey);

    return res.status(200).json({
      canClaim: !hasClaimed,
      claimed: !!hasClaimed,
      claimedAt: hasClaimed || null,
      featuredProjectId: featured.id,
      featuredProjectName: featured.name,
      tokenAmount: TOKEN_AMOUNT,
    });
  }

  // ========== POST = CLAIM ==========
  if (req.method === 'POST') {
    const { fid, walletAddress } = req.body;

    // Validate
    if (!fid) {
      return res.status(400).json({ error: 'FID required', success: false });
    }
    if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Valid wallet required', success: false });
    }

    const fidNum = parseInt(fid);

    // SECURITY: Neynar validation
    const apiKey = process.env.NEYNAR_API_KEY;
    if (apiKey) {
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
      } catch (error) {
        console.error('[SIMPLE CLAIM] Neynar validation failed:', error);
        return res.status(403).json({
          error: 'Unable to verify your account. Please try again.',
          success: false,
        });
      }
    }

    const claimKey = getClaimKey(fidNum);

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

    // Send tokens
    if (!TOKEN_CONTRACT || !TREASURY_PRIVATE_KEY) {
      // No token config - just mark as claimed
      return res.status(200).json({
        success: true,
        message: 'Claim recorded (no token transfer - config missing)',
        tokenContract: TOKEN_CONTRACT || 'NOT SET',
        treasuryKey: TREASURY_PRIVATE_KEY ? 'SET' : 'NOT SET',
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

      const txHash = await walletClient.writeContract({
        address: checksummedContract,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [checksummedRecipient, amountWei],
      });

      console.log('[SIMPLE CLAIM] Success:', { fid: fidNum, txHash });

      return res.status(200).json({
        success: true,
        message: `Sent ${TOKEN_AMOUNT} tokens!`,
        txHash,
        amount: TOKEN_AMOUNT,
        fid: fidNum,
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

