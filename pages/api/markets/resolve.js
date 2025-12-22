// Resolve a niche prediction market (admin only)
import { resolveMarket, getMarketById } from '../../../lib/markets';
import { isAuthenticated } from '../../../lib/admin-auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Admin only
  const isAdmin = await isAuthenticated(req);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Unauthorized - admin only' });
  }

  try {
    const {
      marketId,
      winner, // 'A', 'B', or 'tie'
      resolutionData, // Data/evidence used to determine winner
    } = req.body;

    if (!marketId || !winner) {
      return res.status(400).json({
        error: 'Missing required fields: marketId, winner',
      });
    }

    const marketIdNum = parseInt(marketId);

    // Verify market exists
    const market = await getMarketById(marketIdNum);
    if (!market) {
      return res.status(404).json({ error: 'Market not found' });
    }

    // Resolve market
    const result = await resolveMarket(marketIdNum, winner, resolutionData || {});

    return res.status(200).json({
      success: true,
      message: 'Market resolved successfully',
      result,
      market: {
        id: market.id,
        question: market.question,
        winner: result.winner,
      },
    });

  } catch (error) {
    console.error('[MARKETS] Error resolving market:', error);
    return res.status(500).json({
      error: error.message || 'Failed to resolve market',
    });
  }
}
