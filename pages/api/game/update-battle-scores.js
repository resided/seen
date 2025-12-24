// Auto-update battle scores based on engagement
// Runs on cron schedule to calculate and update scores in real-time

import { getCurrentBattle, updateBattleScores } from '../../../lib/battles';
import { calculateBattleScores } from '../../../lib/battle-analytics';
import { verifyCronRequest } from '../../../lib/cron-auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // SECURITY: Verify request is from verified cron (not just header check)
  const isCron = verifyCronRequest(req);

  if (!isCron) {
    return res.status(403).json({ error: 'Unauthorized - Verified cron only' });
  }

  try {
    // Get current battle
    const battle = await getCurrentBattle();

    if (!battle) {
      return res.status(200).json({
        message: 'No active battle to update',
        action: 'none',
      });
    }

    if (battle.status !== 'active') {
      return res.status(200).json({
        message: 'Battle not active',
        action: 'none',
        battle: {
          id: battle.id,
          status: battle.status,
        },
      });
    }

    // Calculate scores from engagement
    const { scoreA, scoreB, engagement } = await calculateBattleScores(battle.id);

    // Update battle scores in Redis
    await updateBattleScores(battle.id, scoreA, scoreB);

    console.log('[BATTLE SCORES] Updated:', {
      battleId: battle.id,
      scoreA,
      scoreB,
      engagement,
    });

    return res.status(200).json({
      success: true,
      message: 'Battle scores updated',
      action: 'updated',
      battle: {
        id: battle.id,
        scoreA,
        scoreB,
        engagement,
      },
    });

  } catch (error) {
    console.error('[BATTLE SCORES] Error updating scores:', error);
    return res.status(500).json({
      error: 'Failed to update battle scores',
      details: error.message,
    });
  }
}
