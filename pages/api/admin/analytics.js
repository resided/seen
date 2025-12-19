// Admin API route to fetch analytics and metrics
// Protected by admin FID check
// Supports total, date range, monthly, and quarterly reports

import {
  getTotalMetrics,
  getMetricsByDateRange,
  getMonthlyMetrics,
  getQuarterlyMetrics,
} from '../../../lib/analytics';

// Admin FIDs (same as feedback admin)
const ADMIN_FIDS = [
  parseInt(process.env.ADMIN_FID || '0'),
  // Add more admin FIDs here
].filter(fid => fid > 0);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check admin authentication
  const { fid, type, startDate, endDate, month, year, quarter } = req.query;
  const fidNum = parseInt(fid);

  if (!fid || !ADMIN_FIDS.includes(fidNum)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    let metrics;

    switch (type) {
      case 'total':
        // Get all-time totals
        metrics = await getTotalMetrics();
        break;

      case 'range':
        // Get metrics for date range
        if (!startDate || !endDate) {
          return res.status(400).json({ error: 'startDate and endDate required for range query' });
        }
        metrics = await getMetricsByDateRange(startDate, endDate);
        break;

      case 'monthly':
        // Get metrics for specific month (YYYY-MM)
        if (!month) {
          return res.status(400).json({ error: 'month required for monthly query (YYYY-MM)' });
        }
        metrics = await getMonthlyMetrics(month);
        break;

      case 'quarterly':
        // Get metrics for quarter
        if (!year || !quarter) {
          return res.status(400).json({ error: 'year and quarter (1-4) required for quarterly query' });
        }
        metrics = await getQuarterlyMetrics(parseInt(year), parseInt(quarter));
        break;

      default:
        // Default to total metrics
        metrics = await getTotalMetrics();
    }

    if (!metrics) {
      return res.status(500).json({ error: 'Failed to fetch metrics' });
    }

    return res.status(200).json({
      success: true,
      type: type || 'total',
      metrics,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[ADMIN] Analytics error:', error);
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
}
