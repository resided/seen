// API route to get today's stats for a project
import { getProjectStatsToday, getProjectById } from '../../../lib/projects';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'Missing projectId' });
    }

    // Get project to check if it's featured and has featuredAt
    const project = await getProjectById(parseInt(projectId));
    const featuredAt = project?.status === 'featured' ? project?.featuredAt : null;
    
    const stats = await getProjectStatsToday(parseInt(projectId), featuredAt);

    res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error fetching project stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
}
