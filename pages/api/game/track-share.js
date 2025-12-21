// Track battle shares from Farcaster frames
import { trackBattleShare } from '../../../lib/battle-analytics';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { battleId, team, fid } = req.body;

    if (!battleId || !fid) {
      return res.status(400).json({
        error: 'Missing required fields: battleId, fid',
      });
    }

    // Track the share
    const result = await trackBattleShare(
      parseInt(battleId),
      team || null, // null = general battle share (credits both teams)
      parseInt(fid)
    );

    return res.status(200).json({
      success: true,
      message: 'Share tracked',
      ...result,
    });

  } catch (error) {
    console.error('[BATTLE SHARE] Error tracking share:', error);
    return res.status(500).json({
      error: 'Failed to track share',
      details: error.message,
    });
  }
}
