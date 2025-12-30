// Auto-feature the highest voted active project
// Runs at midnight (00:00) via cron or can be triggered manually
// Top voted project wins; if no votes, keep current featured

import { getFeaturedProject, getAllProjects, setFeaturedProject, resetAllVotes, resetRotationId } from '../../lib/projects';
import { isAuthenticated } from '../../lib/admin-auth';
import { saveFeaturedHistory } from '../../lib/featured-history';
import { verifyCronOrAdmin } from '../../lib/cron-auth';

/**
 * Get all eligible projects for featuring (active OR queued, not archived)
 * This includes both 'active' and 'queued' statuses
 */
async function getEligibleProjects() {
  const projects = await getAllProjects();
  return projects
    .filter(p => (p.status === 'active' || p.status === 'queued') && p.status !== 'archived')
    .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
}

export default async function handler(req, res) {
  // Accept both GET (Vercel cron) and POST (manual trigger)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // SECURITY: Verify request is from admin or verified cron (not just header check)
  const isAuthorized = await verifyCronOrAdmin(req, isAuthenticated);

  if (!isAuthorized) {
    return res.status(403).json({ error: 'Unauthorized - Admin or verified cron required' });
  }

  try {
    console.log('[AUTO-FEATURE] Cron triggered at', new Date().toISOString());

    // Check current featured project
    const currentFeatured = await getFeaturedProject();

    // If no featured project, pick the top voted one immediately
    if (!currentFeatured) {
      console.log('[AUTO-FEATURE] No featured project - selecting top voted');

      const eligibleProjects = await getEligibleProjects();

      if (!eligibleProjects || eligibleProjects.length === 0) {
        return res.status(200).json({
          message: 'No eligible projects available to feature',
          action: 'none',
        });
      }

      // Sort by votes (descending), then alphabetically
      const sortedByVotes = eligibleProjects
        .map(p => ({ ...p, votes: p.votes || 0 }))
        .sort((a, b) => {
          if (b.votes !== a.votes) return b.votes - a.votes;
          return a.name.localeCompare(b.name);
        });

      const winner = sortedByVotes[0];

      // If no votes, pick randomly
      const selectedProject = winner.votes === 0
        ? eligibleProjects[Math.floor(Math.random() * eligibleProjects.length)]
        : winner;

      const result = await setFeaturedProject(selectedProject.id);

      if (!result) {
        throw new Error('Failed to set featured project');
      }

      // Generate new rotation ID for claims
      const newRotationId = await resetRotationId();

      console.log('[AUTO-FEATURE] Featured project set (was empty):', {
        id: selectedProject.id,
        name: selectedProject.name,
        votes: selectedProject.votes || 0,
        rotationId: newRotationId,
      });

      return res.status(200).json({
        success: true,
        message: winner.votes === 0
          ? 'Auto-featured random project (no votes, was empty)'
          : 'Auto-featured top voted project (was empty)',
        action: 'featured',
        winner: {
          id: selectedProject.id,
          name: selectedProject.name,
          votes: selectedProject.votes || 0,
          builder: selectedProject.builder,
          category: selectedProject.category,
        },
        rotationId: newRotationId,
      });
    }

    // Midnight rotation - get highest voted eligible project (active OR queued)
    console.log('[AUTO-FEATURE] Midnight rotation - looking for next winner');

    const eligibleProjects = await getEligibleProjects();

    console.log('[AUTO-FEATURE] Eligible projects:', eligibleProjects.length,
      eligibleProjects.map(p => ({ name: p.name, status: p.status, votes: p.votes || 0 })));

    if (!eligibleProjects || eligibleProjects.length === 0) {
      console.log('[AUTO-FEATURE] No eligible projects available');
      return res.status(200).json({
        message: 'No eligible projects available to feature (need active or queued projects)',
        action: 'none',
        currentFeatured: {
          id: currentFeatured.id,
          name: currentFeatured.name,
        },
      });
    }

    // Sort by votes (descending), then alphabetically by name
    const sortedByVotes = eligibleProjects
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
    console.log('[AUTO-FEATURE] Top candidates:', sortedByVotes.slice(0, 3).map(p => ({ name: p.name, votes: p.votes })));

    // If no one voted, keep current featured project
    if (winner.votes === 0) {
      console.log('[AUTO-FEATURE] No votes - keeping current featured project');

      // Reset votes for next round anyway
      await resetAllVotes();
      console.log('[AUTO-FEATURE] All votes reset to 0 for next round');

      return res.status(200).json({
        success: true,
        message: 'No votes cast - keeping current featured project',
        action: 'kept',
        currentFeatured: {
          id: currentFeatured.id,
          name: currentFeatured.name,
          builder: currentFeatured.builder,
          category: currentFeatured.category,
        },
        note: 'No votes - current project stays featured',
      });
    }

    // Save current featured project's stats to history before replacing
    await saveFeaturedHistory(currentFeatured, currentFeatured.stats);

    // Feature the winner!
    const result = await setFeaturedProject(winner.id);

    if (!result) {
      throw new Error('Failed to set featured project');
    }

    // IMPORTANT: Generate new rotation ID for claims
    const newRotationId = await resetRotationId();
    console.log('[AUTO-FEATURE] Generated new rotation ID:', newRotationId);

    console.log('[AUTO-FEATURE] Winner featured:', {
      winner: {
        id: winner.id,
        name: winner.name,
        votes: winner.votes,
      },
      previous: {
        id: currentFeatured.id,
        name: currentFeatured.name,
        statsSaved: true,
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
      },
      runnerUp: sortedByVotes[1] ? {
        name: sortedByVotes[1].name,
        votes: sortedByVotes[1].votes,
      } : null,
      rotationId: newRotationId,
    });

  } catch (error) {
    console.error('[AUTO-FEATURE] Error:', error);
    return res.status(500).json({
      error: 'Failed to auto-feature winner',
      details: error.message,
    });
  }
}
