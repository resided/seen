// Get all active niche prediction markets
import { getActiveMarkets } from '../../../lib/markets';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const markets = await getActiveMarkets();

    return res.status(200).json({
      success: true,
      markets,
      count: markets.length,
    });

  } catch (error) {
    console.error('[MARKETS] Error fetching active markets:', error);
    return res.status(500).json({ error: 'Failed to fetch markets' });
  }
}
