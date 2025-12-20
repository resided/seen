// API endpoint for community voting
// Users burn 100K $SEEN to vote for a project to be featured
// Implements burn model - tokens are permanently removed from circulation

import { getRedisClient } from '../../lib/redis';
import { getProjectById, incrementProjectVotes } from '../../lib/projects';
import { fetchUserByFid } from '../../lib/neynar';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

// Voting configuration
const VOTE_COST = '100000'; // 100K $SEEN tokens per vote
const SEEN_TOKEN_ADDRESS = '0x82a56d595ccdfa3a1dc6eef28d5f0a870f162b07';
const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD'; // Standard burn address
const MIN_NEYNAR_SCORE = 0.33;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const redis = await getRedisClient();
  if (!redis) {
    return res.status(500).json({ error: 'Redis unavailable' });
  }

  const { projectId, fid, walletAddress, txHash } = req.body;

  // Validate inputs
  if (!projectId || !fid || !walletAddress || !txHash) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['projectId', 'fid', 'walletAddress', 'txHash']
    });
  }

  if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  if (!txHash.match(/^0x[a-fA-F0-9]{64}$/)) {
    return res.status(400).json({ error: 'Invalid transaction hash' });
  }

  const fidNum = parseInt(fid);
  const projectIdNum = parseInt(projectId);

  // SECURITY: Check if this transaction has already been used for a vote
  const txUsedKey = `vote:tx:used:${txHash}`;
  const txUsedData = await redis.get(txUsedKey);

  if (txUsedData) {
    const usedInfo = JSON.parse(txUsedData);
    console.warn('[VOTE] Transaction replay attempt:', {
      txHash,
      attemptedBy: { fid: fidNum, wallet: walletAddress },
      originallyUsedBy: usedInfo,
    });

    return res.status(400).json({
      error: 'Transaction already used for a vote',
      success: false,
    });
  }

  // VERIFY: Check transaction is real and burns correct amount
  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(),
    });

    const tx = await publicClient.getTransaction({ hash: txHash });
    if (!tx) {
      return res.status(400).json({ error: 'Transaction not found on chain' });
    }

    // Verify sender matches wallet
    if (tx.from.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(400).json({
        error: 'Transaction sender does not match wallet',
        txFrom: tx.from,
        claimed: walletAddress,
      });
    }

    // Verify transaction is to burn address
    if (tx.to?.toLowerCase() !== SEEN_TOKEN_ADDRESS.toLowerCase()) {
      return res.status(400).json({
        error: 'Transaction must be to $SEEN token contract',
        expectedContract: SEEN_TOKEN_ADDRESS,
        actualTo: tx.to,
      });
    }

    // Decode transfer data to verify burn address and amount
    // Transfer function signature: 0xa9059cbb (transfer)
    // Followed by: 32 bytes (address), 32 bytes (amount)
    const txData = tx.input;

    if (!txData.startsWith('0xa9059cbb')) {
      return res.status(400).json({ error: 'Transaction must be a token transfer' });
    }

    // Extract recipient address (bytes 4-36, but address is last 20 bytes)
    const recipientHex = '0x' + txData.slice(34, 74);

    if (recipientHex.toLowerCase() !== BURN_ADDRESS.toLowerCase()) {
      return res.status(400).json({
        error: 'Tokens must be sent to burn address',
        expectedBurnAddress: BURN_ADDRESS,
        actualRecipient: recipientHex,
      });
    }

    // Extract amount (bytes 36-68)
    const amountHex = '0x' + txData.slice(74, 138);
    const amountBigInt = BigInt(amountHex);
    const expectedAmount = BigInt(VOTE_COST) * BigInt(10 ** 18); // 100K tokens with 18 decimals

    if (amountBigInt < expectedAmount) {
      return res.status(400).json({
        error: `Insufficient burn amount. Required: ${VOTE_COST} $SEEN`,
        required: expectedAmount.toString(),
        actual: amountBigInt.toString(),
      });
    }

    console.log('[VOTE] Transaction verified:', {
      txHash,
      from: tx.from,
      burnedAmount: (amountBigInt / BigInt(10 ** 18)).toString()
    });

  } catch (error) {
    console.error('[VOTE] Transaction verification failed:', error.message);
    return res.status(400).json({
      error: 'Could not verify transaction. Wait for confirmation and try again.',
    });
  }

  // SECURITY: Neynar validation
  const apiKey = process.env.NEYNAR_API_KEY;
  if (apiKey) {
    try {
      const user = await fetchUserByFid(fidNum, apiKey);
      if (!user) {
        return res.status(403).json({
          error: 'Unable to verify your Farcaster account',
        });
      }

      // Check Neynar score
      const userScore = user.experimental?.neynar_user_score;
      if (userScore === null || userScore === undefined) {
        return res.status(403).json({
          error: 'Neynar score unavailable. Please try again later.',
        });
      }

      if (userScore < MIN_NEYNAR_SCORE) {
        return res.status(403).json({
          error: `Neynar score too low (${userScore.toFixed(2)}). Minimum: ${MIN_NEYNAR_SCORE}`,
          userScore,
          minScore: MIN_NEYNAR_SCORE,
        });
      }
    } catch (error) {
      console.error('[VOTE] Neynar validation failed:', error);
      return res.status(403).json({
        error: 'Unable to verify your account. Please try again.',
      });
    }
  }

  // Verify project exists
  const project = await getProjectById(projectIdNum);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Only queue projects can receive votes
  if (project.status !== 'queue') {
    return res.status(400).json({
      error: 'Only queued projects can receive votes',
      projectStatus: project.status,
    });
  }

  try {
    // Increment vote count for project
    const updatedProject = await incrementProjectVotes(projectIdNum, 1);

    if (!updatedProject) {
      return res.status(500).json({ error: 'Failed to record vote' });
    }

    // Store vote history in Redis
    const voteHistoryKey = `vote:history:${projectIdNum}:${Date.now()}`;
    const voteData = {
      projectId: projectIdNum,
      projectName: project.name,
      fid: fidNum,
      wallet: walletAddress,
      txHash,
      voteCost: VOTE_COST,
      timestamp: Date.now(),
      timestampISO: new Date().toISOString(),
    };

    await redis.set(voteHistoryKey, JSON.stringify(voteData), {
      EX: 365 * 24 * 60 * 60, // Keep for 1 year
    });

    // Mark transaction as used
    await redis.set(txUsedKey, JSON.stringify({
      fid: fidNum,
      wallet: walletAddress,
      projectId: projectIdNum,
      timestamp: Date.now(),
    }), {
      EX: 365 * 24 * 60 * 60, // 1 year
    });

    // Add to sorted set for leaderboard (score = vote count)
    await redis.zAdd('vote:leaderboard', {
      score: updatedProject.votes || 1,
      value: projectIdNum.toString(),
    });

    console.log('[VOTE] Vote recorded:', {
      projectId: projectIdNum,
      projectName: project.name,
      fid: fidNum,
      newVoteCount: updatedProject.votes,
    });

    return res.status(200).json({
      success: true,
      message: `Vote recorded! ${VOTE_COST} $SEEN burned 🔥`,
      project: {
        id: updatedProject.id,
        name: updatedProject.name,
        votes: updatedProject.votes,
      },
      txHash,
      burnedAmount: VOTE_COST,
    });

  } catch (error) {
    console.error('[VOTE] Failed to record vote:', error);
    return res.status(500).json({ error: 'Failed to record vote' });
  }
}
