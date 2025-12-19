// API route to fetch total platform statistics
// Shows total views and clicks across all projects

import { getTotalMetrics } from '../../lib/analytics';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const metrics = await getTotalMetrics();

    if (!metrics) {
      return res.status(500).json({ error: 'Failed to fetch metrics' });
    }

    // Calculate totals
    const totalClicks = metrics.miniapp_click?.count || 0;
    const totalViews = metrics.page_view?.count || 0;
    const totalListings = metrics.listing_submit?.count || 0;
    const totalUsers = metrics.unique_users || 0;

    return res.status(200).json({
      success: true,
      stats: {
        totalClicks,
        totalViews,
        totalListings,
        totalUsers,
      },
    });

  } catch (error) {
    console.error('[STATS] Error fetching total stats:', error);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
}
