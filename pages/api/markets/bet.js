// Place a bet on a niche prediction market
import { placeBet, getMarketById } from '../../../lib/markets';
import { fetchUserByFid } from '../../../lib/neynar';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

// Security configuration
const MIN_NEYNAR_SCORE = 0.62;
const MIN_ACCOUNT_AGE_DAYS = 2;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      fid,
      marketId,
      option, // 'A' or 'B'
      amount,
      txHash,
    } = req.body;

    // Validate inputs
    if (!fid || !marketId || !option || !amount || !txHash) {
      return res.status(400).json({
        error: 'Missing required fields: fid, marketId, option, amount, txHash',
      });
    }

    const fidNum = parseInt(fid);
    const marketIdNum = parseInt(marketId);
    const amountNum = parseFloat(amount);

    if (isNaN(fidNum) || fidNum <= 0) {
      return res.status(400).json({ error: 'Invalid FID' });
    }

    if (isNaN(marketIdNum) || marketIdNum <= 0) {
      return res.status(400).json({ error: 'Invalid market ID' });
    }

    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (!txHash || !txHash.match(/^0x[a-fA-F0-9]{64}$/)) {
      return res.status(400).json({
        error: 'Valid transaction hash required',
      });
    }

    // Verify option
    if (option !== 'A' && option !== 'B') {
      return res.status(400).json({
        error: 'Invalid option - must be A or B',
      });
    }

    // Verify market exists
    const market = await getMarketById(marketIdNum);
    if (!market) {
      return res.status(404).json({ error: 'Market not found' });
    }

    // Verify transaction on chain
    try {
      const publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });

      const tx = await publicClient.getTransaction({ hash: txHash });
      if (!tx) {
        return res.status(400).json({
          error: 'Transaction not found on chain',
        });
      }

      console.log('[MARKET BET] Transaction verified:', { txHash, from: tx.from });
    } catch (error) {
      console.error('[MARKET BET] Transaction verification failed:', error.message);
      return res.status(400).json({
        error: 'Could not verify transaction. Wait for confirmation and try again.',
      });
    }

    // Neynar validation
    const apiKey = process.env.NEYNAR_API_KEY;
    if (apiKey) {
      try {
        const user = await fetchUserByFid(fidNum, apiKey);
        if (!user) {
          return res.status(403).json({
            error: 'Unable to verify your Farcaster account',
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
              error: `Account too new. Must be ${MIN_ACCOUNT_AGE_DAYS}+ days old`,
              accountAgeDays: accountAgeDays.toFixed(1),
            });
          }
        }

        // Check Neynar score
        const userScore = user.experimental?.neynar_user_score;
        if (userScore !== null && userScore !== undefined && userScore < MIN_NEYNAR_SCORE) {
          return res.status(403).json({
            error: `Neynar score too low (${userScore.toFixed(2)}). Minimum: ${MIN_NEYNAR_SCORE}`,
          });
        }
      } catch (error) {
        console.error('[MARKET BET] Neynar validation failed:', error);
        return res.status(403).json({
          error: 'Unable to verify your account. Please try again.',
        });
      }
    }

    // Place bet
    const bet = await placeBet(marketIdNum, fidNum, option, amountNum, txHash);

    return res.status(200).json({
      success: true,
      message: `Bet placed on ${market.question}`,
      bet,
      market: {
        id: market.id,
        question: market.question,
        optionA: market.optionA,
        optionB: market.optionB,
      },
    });

  } catch (error) {
    console.error('[MARKET BET] Error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to place bet',
    });
  }
}
