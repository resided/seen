// API route to fetch total platform statistics
// Shows total views and clicks across all projects

import { getRedisClient } from '../../lib/redis';
import { getAllProjects } from '../../lib/projects';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const redis = await getRedisClient();
    const allProjects = await getAllProjects();
    const { getProjectStatsToday, getRotationId } = await import('../../lib/projects');

    // Get current rotation ID for featured projects
    const currentRotationId = redis ? await getRotationId() : null;

    let totalViews = 0;
    let totalClicks = 0;

    // Sum up views and clicks from all projects
    // For featured projects: use current window stats (Redis)
    // For non-featured projects: use persistent stats
    for (const project of allProjects) {
      let projectViews = 0;
      let projectClicks = 0;

      if (project.status === 'featured' && currentRotationId && redis) {
        // Featured project: get current window stats using rotation ID
        const windowStats = await getProjectStatsToday(project.id, currentRotationId);
        projectViews = windowStats.views || 0;
        projectClicks = windowStats.clicks || 0;
      } else {
        // Non-featured: use persistent stats
        projectViews = project.stats?.views || 0;
        projectClicks = project.stats?.clicks || 0;
      }

      totalViews += projectViews;
      totalClicks += projectClicks;
    }

    return res.status(200).json({
      success: true,
      stats: {
        totalViews,
        totalClicks,
        totalListings: allProjects.length,
        totalUsers: 0, // Can add if needed
      },
    });

  } catch (error) {
    console.error('[STATS] Error fetching total stats:', error);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
}
