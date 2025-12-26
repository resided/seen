// Force rotate to next project - Admin only
// Simple endpoint that can be called from mobile browser with admin token

import { getFeaturedProject, getActiveProjects, getAllProjects, setFeaturedProject, resetAllVotes, resetRotationId } from '../../../lib/projects';
import { saveFeaturedHistory } from '../../../lib/featured-history';
import { getRedisClient } from '../../../lib/redis';

// Simple token check - set ADMIN_ROTATE_TOKEN in env
const ADMIN_ROTATE_TOKEN = process.env.ADMIN_ROTATE_TOKEN;

export default async function handler(req, res) {
  // Allow GET for easy mobile access
  const token = req.query.token || req.body?.token;
  
  if (!ADMIN_ROTATE_TOKEN) {
    return res.status(500).json({ error: 'ADMIN_ROTATE_TOKEN not configured' });
  }
  
  if (token !== ADMIN_ROTATE_TOKEN) {
    return res.status(403).json({ error: 'Invalid token' });
  }

  try {
    const currentFeatured = await getFeaturedProject();
    
    if (!currentFeatured) {
      return res.status(400).json({ error: 'No featured project to rotate from' });
    }

    // Get all eligible projects (active or queued)
    const allProjects = await getAllProjects();
    const eligibleProjects = allProjects
      .filter(p => (p.status === 'active' || p.status === 'queued') && p.id !== currentFeatured.id);
    
    if (eligibleProjects.length === 0) {
      return res.status(400).json({ error: 'No eligible projects to rotate to' });
    }

    // Sort by votes (descending)
    const sortedByVotes = eligibleProjects
      .map(p => ({ ...p, votes: p.votes || 0 }))
      .sort((a, b) => b.votes - a.votes);

    const winner = sortedByVotes[0];

    // Save current featured to history
    await saveFeaturedHistory(currentFeatured, currentFeatured.stats);

    // Feature the winner
    const result = await setFeaturedProject(winner.id);
    if (!result) {
      throw new Error('Failed to set featured project');
    }

    // Generate new rotation ID
    const newRotationId = await resetRotationId();

    // Reset votes
    await resetAllVotes();

    console.log('[FORCE ROTATE] Success:', {
      previous: currentFeatured.name,
      new: winner.name,
      votes: winner.votes,
      rotationId: newRotationId,
    });

    return res.status(200).json({
      success: true,
      message: `Rotated from "${currentFeatured.name}" to "${winner.name}"`,
      previous: {
        id: currentFeatured.id,
        name: currentFeatured.name,
      },
      new: {
        id: winner.id,
        name: winner.name,
        votes: winner.votes,
      },
      rotationId: newRotationId,
      eligibleCount: eligibleProjects.length,
    });

  } catch (error) {
    console.error('[FORCE ROTATE] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
