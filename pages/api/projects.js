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
    if (featured?.id) {
      const todayStats = await getProjectStatsToday(featured.id);
      if (todayStats.views > 0 || todayStats.clicks > 0) {
        featured.stats = {
          ...featured.stats,
          views: todayStats.views,
          clicks: todayStats.clicks,
        };
      }
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

