// API endpoint to get voting leaderboard
// Returns top voted queue projects

import { getQueuedProjects } from '../../lib/projects';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { limit = 10 } = req.query;
    const limitNum = parseInt(limit);

    // Get all queue projects
    const queueProjects = await getQueuedProjects();

    if (!queueProjects || queueProjects.length === 0) {
      return res.status(200).json({
        leaderboard: [],
        total: 0,
      });
    }

    // Sort by votes (descending), then by submission date (oldest first)
    const sortedProjects = queueProjects
      .map(project => ({
        id: project.id,
        name: project.name,
        tagline: project.tagline,
        description: project.description,
        builder: project.builder,
        builderFid: project.builderFid,
        category: project.category,
        votes: project.votes || 0,
        submittedAt: project.submittedAt,
        links: project.links,
      }))
      .sort((a, b) => {
        // First sort by votes (descending)
        if (b.votes !== a.votes) {
          return b.votes - a.votes;
        }
        // If votes are equal, sort by submission date (oldest first)
        return new Date(a.submittedAt) - new Date(b.submittedAt);
      });

    // Take top N projects
    const leaderboard = sortedProjects.slice(0, limitNum);

    // Calculate total votes across all projects
    const totalVotes = sortedProjects.reduce((sum, p) => sum + p.votes, 0);

    return res.status(200).json({
      leaderboard,
      total: sortedProjects.length,
      totalVotes,
    });

  } catch (error) {
    console.error('[VOTE LEADERBOARD] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
}
