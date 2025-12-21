// Get current active battle
import { getCurrentBattle } from '../../../lib/battles';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const battle = await getCurrentBattle();

    if (!battle) {
      return res.status(200).json({
        battle: null,
        message: 'No active battle',
      });
    }

    return res.status(200).json({
      success: true,
      battle,
    });
  } catch (error) {
    console.error('[BATTLE] Error fetching current battle:', error);
    return res.status(500).json({
      error: 'Failed to fetch current battle',
      details: error.message,
    });
  }
}
