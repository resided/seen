// Get all available niche market templates
import { NICHE_MARKET_TEMPLATES } from '../../../lib/markets';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    return res.status(200).json({
      success: true,
      templates: NICHE_MARKET_TEMPLATES,
      count: NICHE_MARKET_TEMPLATES.length,
    });

  } catch (error) {
    console.error('[MARKETS] Error fetching templates:', error);
    return res.status(500).json({ error: 'Failed to fetch templates' });
  }
}
