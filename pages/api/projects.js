// API route to fetch projects
import { getFeaturedProject, getQueuedProjects, getProjectStatsToday } from '../../lib/projects'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const featured = await getFeaturedProject()
    const queue = await getQueuedProjects()

    // Merge real-time stats with stored stats for featured project
    // Use window stats from Redis if available (they include manual overrides), otherwise use stored stats
    if (featured?.id) {
      const windowStats = await getProjectStatsToday(featured.id, featured.rotationId);
      // Always use window stats (they reflect manual overrides and continue counting)
      // If window stats exist, use them; otherwise fall back to stored stats
        featured.stats = {
          ...featured.stats,
        views: windowStats.views || (featured.stats?.views || 0),
        clicks: windowStats.clicks || (featured.stats?.clicks || 0),
        };
    }

    res.status(200).json({
      featured,
      queue
    })
  } catch (error) {
    console.error('Error fetching projects:', error)
    res.status(500).json({ error: 'Failed to fetch projects' })
  }
}

