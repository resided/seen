// Auto-feature the highest voted active project
// Runs on schedule via cron or can be triggered manually
// When current featured expires (24h), highest voted project wins

import { getFeaturedProject, getActiveProjects, setFeaturedProject, resetAllVotes } from '../../lib/projects';
import { isAuthenticated } from '../../lib/admin-auth';

// How long a project stays featured before auto-rotation (24 hours)
const FEATURED_DURATION_MS = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Allow cron or admin to trigger this
  const isCron = req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`;
  const isAdmin = await isAuthenticated(req);

  if (!isCron && !isAdmin) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    // Check current featured project
    const currentFeatured = await getFeaturedProject();

    if (!currentFeatured) {
      return res.status(200).json({
        message: 'No featured project - skipping auto-feature',
        action: 'none',
      });
    }

    // Check if featured project has been up long enough
    const featuredAt = new Date(currentFeatured.featuredAt);
    const now = new Date();
    const timeElapsed = now - featuredAt;

    if (timeElapsed < FEATURED_DURATION_MS) {
      const remainingTime = FEATURED_DURATION_MS - timeElapsed;
      const remainingHours = (remainingTime / (60 * 60 * 1000)).toFixed(1);

      return res.status(200).json({
        message: 'Current featured project still active',
        action: 'none',
        currentFeatured: {
          id: currentFeatured.id,
          name: currentFeatured.name,
          featuredAt: currentFeatured.featuredAt,
          timeElapsed: `${(timeElapsed / (60 * 60 * 1000)).toFixed(1)} hours`,
          remainingTime: `${remainingHours} hours`,
        },
      });
    }

    // Featured has expired - get highest voted active project
    const activeProjects = await getActiveProjects();

    if (!activeProjects || activeProjects.length === 0) {
      return res.status(200).json({
        message: 'No active projects available to feature',
        action: 'none',
        expiredFeatured: {
          id: currentFeatured.id,
          name: currentFeatured.name,
        },
      });
    }

    // Sort by votes (descending), then alphabetically by name
    const sortedByVotes = activeProjects
      .map(p => ({
        ...p,
        votes: p.votes || 0,
      }))
      .sort((a, b) => {
        // Primary sort: votes (descending)
        if (b.votes !== a.votes) {
          return b.votes - a.votes;
        }
        // Tiebreaker: alphabetical order
        return a.name.localeCompare(b.name);
      });

    const winner = sortedByVotes[0];

    // Check if winner has any votes
    if (winner.votes === 0) {
      return res.status(200).json({
        message: 'No projects have votes - keeping current featured',
        action: 'none',
        expiredFeatured: {
          id: currentFeatured.id,
          name: currentFeatured.name,
        },
        note: 'Auto-feature requires at least 1 vote',
      });
    }

    // Feature the winner!
    const result = await setFeaturedProject(winner.id);

    if (!result) {
      throw new Error('Failed to set featured project');
    }

    console.log('[AUTO-FEATURE] Winner featured:', {
      winner: {
        id: winner.id,
        name: winner.name,
        votes: winner.votes,
      },
      previous: {
        id: currentFeatured.id,
        name: currentFeatured.name,
        duration: `${(timeElapsed / (60 * 60 * 1000)).toFixed(1)} hours`,
      },
    });

    // Reset all votes for the next round
    await resetAllVotes();
    console.log('[AUTO-FEATURE] All votes reset to 0 for next round');

    return res.status(200).json({
      success: true,
      message: 'Auto-featured highest voted project!',
      action: 'featured',
      winner: {
        id: winner.id,
        name: winner.name,
        votes: winner.votes,
        builder: winner.builder,
        category: winner.category,
      },
      previous: {
        id: currentFeatured.id,
        name: currentFeatured.name,
        timeElapsed: `${(timeElapsed / (60 * 60 * 1000)).toFixed(1)} hours`,
      },
      runnerUp: sortedByVotes[1] ? {
        name: sortedByVotes[1].name,
        votes: sortedByVotes[1].votes,
      } : null,
    });

  } catch (error) {
    console.error('[AUTO-FEATURE] Error:', error);
    return res.status(500).json({
      error: 'Failed to auto-feature winner',
      details: error.message,
    });
  }
}
