// Resolve a battle and calculate winnings
import { resolveBattle, getCurrentBattle, isBattleEnded } from '../../../lib/battles';
import { isAuthenticated } from '../../../lib/admin-auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Allow cron or admin to trigger this
  const isCron = req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`;
  const isAdmin = await isAuthenticated(req);

  if (!isCron && !isAdmin) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { battleId } = req.body;

  try {
    let targetBattle;

    if (battleId) {
      // Resolve specific battle
      targetBattle = { id: parseInt(battleId) };
    } else {
      // Resolve current battle if ended
      targetBattle = await getCurrentBattle();

      if (!targetBattle) {
        return res.status(200).json({
          message: 'No active battle to resolve',
          action: 'none',
        });
      }

      if (!isBattleEnded(targetBattle)) {
        const endTime = new Date(targetBattle.endTime);
        const now = new Date();
        const remaining = endTime - now;
        const remainingHours = (remaining / (1000 * 60 * 60)).toFixed(1);

        return res.status(200).json({
          message: 'Battle not yet ended',
          action: 'none',
          battle: {
            id: targetBattle.id,
            endTime: targetBattle.endTime,
            remainingTime: `${remainingHours} hours`,
          },
        });
      }
    }

    // Resolve the battle
    const result = await resolveBattle(targetBattle.id);

    console.log('[BATTLE] Resolved:', result);

    return res.status(200).json({
      success: true,
      message: 'Battle resolved successfully',
      action: 'resolved',
      result,
    });

  } catch (error) {
    console.error('[BATTLE] Error resolving battle:', error);
    return res.status(500).json({
      error: 'Failed to resolve battle',
      details: error.message,
    });
  }
}
