// API route to get featured history
// Protected by admin authentication

import { getFeaturedHistory, getProjectFeaturedHistory } from '../../../lib/featured-history';
import { isAuthenticated } from '../../../lib/admin-auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check admin authentication
  if (!(await isAuthenticated(req))) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const { projectId, limit = 50 } = req.query;

    let history;
    if (projectId) {
      // Get history for specific project
      history = await getProjectFeaturedHistory(parseInt(projectId));
    } else {
      // Get all history
      history = await getFeaturedHistory(parseInt(limit));
    }

    return res.status(200).json({
      success: true,
      history,
      count: history.length,
    });

  } catch (error) {
    console.error('[FEATURED HISTORY API] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch featured history' });
  }
}
