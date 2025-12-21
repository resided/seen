// Place a bet on a battle
import { placeBet, getCurrentBattle, isBattleEnded } from '../../../lib/battles';
import { getRedisClient } from '../../../lib/redis';
import { createPublicClient, http, erc20Abi } from 'viem';
import { base } from 'viem/chains';

// $SEEN token on Base
const SEEN_TOKEN_ADDRESS = '0xA29Cf6c8cD61FFE04108CaBd0Ab2A3310Bb44801';

// Treasury address for bets
const TREASURY_ADDRESS = '0x32b907f125c4b929d5d9565fa24bc6bf9af39fbb';

// Minimum bet amount (100K $SEEN)
const MIN_BET_AMOUNT = 100000;

// Create Base client for transaction verification
const baseClient = createPublicClient({
  chain: base,
  transport: http(),
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { battleId, userFid, team, txHash } = req.body;

  // Validate inputs
  if (!battleId || !userFid || !team || !txHash) {
    return res.status(400).json({
      error: 'Missing required fields: battleId, userFid, team, txHash',
    });
  }

  if (team !== 'A' && team !== 'B') {
    return res.status(400).json({
      error: 'Invalid team - must be A or B',
    });
  }

  try {
    // Check if transaction was already used
    const redis = await getRedisClient();
    const txKey = `bet:tx:${txHash}`;
    const txUsed = await redis.get(txKey);
    if (txUsed) {
      return res.status(400).json({
        error: 'Transaction already used for a bet',
      });
    }

    // Get current battle
    const battle = await getCurrentBattle();
    if (!battle) {
      return res.status(400).json({
        error: 'No active battle',
      });
    }

    if (battle.id !== parseInt(battleId)) {
      return res.status(400).json({
        error: 'Battle ID does not match current battle',
      });
    }

    // Check if battle is still active
    if (battle.status !== 'active') {
      return res.status(400).json({
        error: 'Battle is not active',
      });
    }

    if (isBattleEnded(battle)) {
      return res.status(400).json({
        error: 'Battle has ended - betting is closed',
      });
    }

    // Verify transaction on-chain
    console.log('[BET] Verifying transaction:', txHash);

    const receipt = await baseClient.getTransactionReceipt({
      hash: txHash,
    });

    if (!receipt || receipt.status !== 'success') {
      return res.status(400).json({
        error: 'Transaction failed or not found',
      });
    }

    // Parse transfer logs to validate
    const transferLog = receipt.logs.find(log => {
      try {
        if (log.address.toLowerCase() !== SEEN_TOKEN_ADDRESS.toLowerCase()) {
          return false;
        }

        const decodedLog = baseClient.decodeEventLog({
          abi: erc20Abi,
          data: log.data,
          topics: log.topics,
        });

        return (
          decodedLog.eventName === 'Transfer' &&
          decodedLog.args.to?.toLowerCase() === TREASURY_ADDRESS.toLowerCase()
        );
      } catch {
        return false;
      }
    });

    if (!transferLog) {
      return res.status(400).json({
        error: 'No valid $SEEN transfer to treasury found in transaction',
      });
    }

    // Decode transfer amount
    const decodedLog = baseClient.decodeEventLog({
      abi: erc20Abi,
      data: transferLog.data,
      topics: transferLog.topics,
    });

    const amount = Number(decodedLog.args.value);

    // Validate minimum bet
    if (amount < MIN_BET_AMOUNT) {
      return res.status(400).json({
        error: `Minimum bet is ${MIN_BET_AMOUNT} $SEEN`,
        sent: amount,
      });
    }

    // Mark transaction as used
    await redis.set(txKey, JSON.stringify({
      battleId,
      userFid,
      team,
      amount,
      timestamp: new Date().toISOString(),
    }));

    // Place the bet
    const bet = await placeBet(battleId, userFid, team, amount, txHash);

    console.log('[BET] Bet placed successfully:', {
      battleId,
      userFid,
      team,
      amount,
    });

    return res.status(200).json({
      success: true,
      message: 'Bet placed successfully',
      bet: {
        battleId: bet.battleId,
        team: bet.team,
        amount: bet.amount,
        placedAt: bet.placedAt,
      },
      battle: {
        id: battle.id,
        poolA: team === 'A' ? battle.poolA + amount : battle.poolA,
        poolB: team === 'B' ? battle.poolB + amount : battle.poolB,
      },
    });

  } catch (error) {
    console.error('[BET] Error placing bet:', error);
    return res.status(500).json({
      error: 'Failed to place bet',
      details: error.message,
    });
  }
}
