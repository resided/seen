// Get user's bets
import { getUserBets } from '../../../lib/battles';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fid } = req.query;

  if (!fid) {
    return res.status(400).json({
      error: 'Missing required parameter: fid',
    });
  }

  try {
    const bets = await getUserBets(parseInt(fid));

    return res.status(200).json({
      success: true,
      bets,
    });
  } catch (error) {
    console.error('[BET] Error fetching user bets:', error);
    return res.status(500).json({
      error: 'Failed to fetch user bets',
      details: error.message,
    });
  }
}
