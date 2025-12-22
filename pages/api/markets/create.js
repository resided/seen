// Create a new niche prediction market (admin only)
import { createMarket, NICHE_MARKET_TEMPLATES } from '../../../lib/markets';
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
      templateIndex,
      customMarket,
      resolveDate,
    } = req.body;

    let marketData;

    if (templateIndex !== undefined && templateIndex !== null) {
      // Use pre-configured template
      const template = NICHE_MARKET_TEMPLATES[templateIndex];
      if (!template) {
        return res.status(400).json({
          error: 'Invalid template index',
          availableTemplates: NICHE_MARKET_TEMPLATES.length,
        });
      }

      marketData = {
        ...template,
        resolveDate: resolveDate || getDefaultResolveDate(template.type),
      };
    } else if (customMarket) {
      // Use custom market data
      marketData = {
        ...customMarket,
        resolveDate: resolveDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
    } else {
      return res.status(400).json({
        error: 'Either templateIndex or customMarket required',
      });
    }

    // Validate required fields
    if (!marketData.question || !marketData.optionA || !marketData.optionB) {
      return res.status(400).json({
        error: 'Missing required fields: question, optionA, optionB',
      });
    }

    const market = await createMarket(marketData);

    return res.status(200).json({
      success: true,
      message: 'Market created successfully',
      market,
    });

  } catch (error) {
    console.error('[MARKETS] Error creating market:', error);
    return res.status(500).json({
      error: 'Failed to create market',
      details: error.message,
    });
  }
}

// Helper to get default resolve date based on market type
function getDefaultResolveDate(type) {
  const now = new Date();

  switch (type) {
    case 'passengers':
    case 'holidays':
      // End of month
      return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    case 'google':
    case 'social':
      // End of week (7 days)
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    case 'weather':
      // Next Saturday
      const daysUntilSaturday = (6 - now.getDay() + 7) % 7 || 7;
      return new Date(now.getTime() + daysUntilSaturday * 24 * 60 * 60 * 1000).toISOString();

    default:
      // 7 days
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }
}
