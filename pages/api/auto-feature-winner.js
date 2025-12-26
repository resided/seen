// Auto-feature the highest voted active project
// Runs on schedule via cron or can be triggered manually
// When current featured expires (24h), highest voted project wins

import { getFeaturedProject, getActiveProjects, getAllProjects, setFeaturedProject, resetAllVotes, resetRotationId } from '../../lib/projects';
import { isAuthenticated } from '../../lib/admin-auth';
import { saveFeaturedHistory } from '../../lib/featured-history';
import { verifyCronOrAdmin } from '../../lib/cron-auth';

// How long a project stays featured before auto-rotation (24 hours)
const FEATURED_DURATION_MS = 24 * 60 * 60 * 1000;

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
  if (req.method !== 'POST') {
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

    if (!currentFeatured) {
      console.log('[AUTO-FEATURE] No featured project found');
      
      // Try to feature any eligible project if none is featured
      const eligibleProjects = await getEligibleProjects();
      if (eligibleProjects.length > 0) {
        const randomWinner = eligibleProjects[Math.floor(Math.random() * eligibleProjects.length)];
        const result = await setFeaturedProject(randomWinner.id);
        await resetRotationId();
        
        console.log('[AUTO-FEATURE] Featured first project:', randomWinner.name);
        return res.status(200).json({
          success: true,
          message: 'Featured first available project (none was featured)',
          action: 'featured',
          winner: {
            id: randomWinner.id,
            name: randomWinner.name,
          },
        });
      }
      
      return res.status(200).json({
        message: 'No featured project and no eligible projects - skipping auto-feature',
        action: 'none',
      });
    }

    // Check if featured project has been up long enough
    const featuredAt = new Date(currentFeatured.featuredAt);
    const now = new Date();
    const timeElapsed = now - featuredAt;

    console.log('[AUTO-FEATURE] Current featured:', {
      name: currentFeatured.name,
      featuredAt: currentFeatured.featuredAt,
      timeElapsedHours: (timeElapsed / (60 * 60 * 1000)).toFixed(2),
      durationHours: (FEATURED_DURATION_MS / (60 * 60 * 1000)).toFixed(1),
    });

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

    console.log('[AUTO-FEATURE] Featured project expired - looking for next winner');

    // Featured has expired - get highest voted eligible project (active OR queued)
    const eligibleProjects = await getEligibleProjects();

    console.log('[AUTO-FEATURE] Eligible projects:', eligibleProjects.length, 
      eligibleProjects.map(p => ({ name: p.name, status: p.status, votes: p.votes || 0 })));

    if (!eligibleProjects || eligibleProjects.length === 0) {
      console.log('[AUTO-FEATURE] No eligible projects available');
      return res.status(200).json({
        message: 'No eligible projects available to feature (need active or queued projects)',
        action: 'none',
        expiredFeatured: {
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

    // If no one voted, randomly select from eligible projects instead of keeping expired project
    if (winner.votes === 0) {
      console.log('[AUTO-FEATURE] No votes - selecting random project');
      const randomIndex = Math.floor(Math.random() * eligibleProjects.length);
      const randomWinner = eligibleProjects[randomIndex];

      // Save current featured project's stats
      await saveFeaturedHistory(currentFeatured, currentFeatured.stats);

      // Feature random winner
      const result = await setFeaturedProject(randomWinner.id);

      if (!result) {
        throw new Error('Failed to set featured project');
      }
      
      // IMPORTANT: Generate new rotation ID for claims
      const newRotationId = await resetRotationId();
      console.log('[AUTO-FEATURE] Generated new rotation ID:', newRotationId);

      console.log('[AUTO-FEATURE] Random winner featured (no votes):', {
        winner: {
          id: randomWinner.id,
          name: randomWinner.name,
        },
        previous: {
          id: currentFeatured.id,
          name: currentFeatured.name,
        },
      });

      // Reset all votes for the next round
      await resetAllVotes();
      console.log('[AUTO-FEATURE] All votes reset to 0 for next round');

      return res.status(200).json({
        success: true,
        message: 'Auto-featured random project (no votes)',
        action: 'featured',
        winner: {
          id: randomWinner.id,
          name: randomWinner.name,
          votes: 0,
          builder: randomWinner.builder,
          category: randomWinner.category,
        },
        previous: {
          id: currentFeatured.id,
          name: currentFeatured.name,
          timeElapsed: `${(timeElapsed / (60 * 60 * 1000)).toFixed(1)} hours`,
        },
        rotationId: newRotationId,
        note: 'No votes - random selection',
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
        duration: `${(timeElapsed / (60 * 60 * 1000)).toFixed(1)} hours`,
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
        timeElapsed: `${(timeElapsed / (60 * 60 * 1000)).toFixed(1)} hours`,
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
