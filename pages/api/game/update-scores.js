// Update battle scores (for live tracking)
import { updateBattleScores, getBattleById } from '../../../lib/battles';
import { isAuthenticated } from '../../../lib/admin-auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Admin only (scores will be updated by a tracking system)
  const isAdmin = await isAuthenticated(req);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Unauthorized - admin only' });
  }

  const { battleId, scoreA, scoreB } = req.body;

  if (!battleId || scoreA === undefined || scoreB === undefined) {
    return res.status(400).json({
      error: 'Missing required fields: battleId, scoreA, scoreB',
    });
  }

  try {
    // Verify battle exists
    const battle = await getBattleById(parseInt(battleId));
    if (!battle) {
      return res.status(404).json({
        error: 'Battle not found',
      });
    }

    // Update scores
    await updateBattleScores(parseInt(battleId), parseInt(scoreA), parseInt(scoreB));

    console.log('[BATTLE] Updated scores:', {
      battleId,
      scoreA,
      scoreB,
    });

    return res.status(200).json({
      success: true,
      message: 'Scores updated successfully',
      battle: {
        id: battle.id,
        scoreA: parseInt(scoreA),
        scoreB: parseInt(scoreB),
      },
    });

  } catch (error) {
    console.error('[BATTLE] Error updating scores:', error);
    return res.status(500).json({
      error: 'Failed to update scores',
      details: error.message,
    });
  }
}
