// Featured History Management
// Save and retrieve historical stats for featured projects

import { getRedisClient } from './redis';

const FEATURED_HISTORY_KEY = 'featured:history';

/**
 * Save featured project stats when it's about to be replaced
 * @param {Object} project - The project that was featured
 * @param {Object} stats - Final stats during featured period
 * @returns {Promise<boolean>} - Success status
 */
export async function saveFeaturedHistory(project, stats = {}) {
  const redis = await getRedisClient();
  if (!redis) {
    console.error('[FEATURED HISTORY] Redis unavailable');
    return false;
  }

  try {
    const historyEntry = {
      id: `${project.id}-${Date.now()}`, // Unique ID: projectId-timestamp
      projectId: project.id,
      projectName: project.name,
      builder: project.builder,
      builderFid: project.builderFid,
      category: project.category,
      featuredAt: project.featuredAt,
      unfeaturedAt: new Date().toISOString(),
      duration: project.featuredAt
        ? Date.now() - new Date(project.featuredAt).getTime()
        : 0,
      stats: {
        views: stats.views || project.stats?.views || 0,
        clicks: stats.clicks || project.stats?.clicks || 0,
        votes: project.votes || 0,
        tips: stats.tips || project.stats?.tips || 0,
      },
      links: project.links || {},
    };

    // Add to sorted set (sorted by unfeaturedAt timestamp)
    const score = Date.now();
    await redis.zAdd(FEATURED_HISTORY_KEY, {
      score,
      value: historyEntry.id,
    });

    // Store the full history entry
    await redis.set(
      `featured:history:${historyEntry.id}`,
      JSON.stringify(historyEntry)
    );

    console.log('[FEATURED HISTORY] Saved:', {
      project: project.name,
      duration: `${(historyEntry.duration / (60 * 60 * 1000)).toFixed(1)}h`,
      stats: historyEntry.stats,
    });

    return true;
  } catch (error) {
    console.error('[FEATURED HISTORY] Error saving:', error);
    return false;
  }
}

/**
 * Get featured history (most recent first)
 * @param {number} limit - Max number of entries to return
 * @returns {Promise<Array>} - Array of history entries
 */
export async function getFeaturedHistory(limit = 50) {
  const redis = await getRedisClient();
  if (!redis) {
    console.error('[FEATURED HISTORY] Redis unavailable');
    return [];
  }

  try {
    // Get IDs sorted by most recent first
    const ids = await redis.zRange(FEATURED_HISTORY_KEY, 0, -1, {
      REV: true, // Reverse order (newest first)
    });

    if (!ids || ids.length === 0) {
      return [];
    }

    // Fetch full entries
    const entries = await Promise.all(
      ids.slice(0, limit).map(async (id) => {
        const data = await redis.get(`featured:history:${id}`);
        return data ? JSON.parse(data) : null;
      })
    );

    return entries.filter(Boolean);
  } catch (error) {
    console.error('[FEATURED HISTORY] Error fetching:', error);
    return [];
  }
}

/**
 * Get featured history for a specific project
 * @param {number} projectId - Project ID
 * @returns {Promise<Array>} - Array of history entries for this project
 */
export async function getProjectFeaturedHistory(projectId) {
  const allHistory = await getFeaturedHistory(200); // Get more to ensure we capture all
  return allHistory.filter(entry => entry.projectId === parseInt(projectId));
}

/**
 * Delete a featured history entry
 * @param {string} historyId - History entry ID
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteFeaturedHistory(historyId) {
  const redis = await getRedisClient();
  if (!redis) return false;

  try {
    await redis.zRem(FEATURED_HISTORY_KEY, historyId);
    await redis.del(`featured:history:${historyId}`);
    console.log('[FEATURED HISTORY] Deleted:', historyId);
    return true;
  } catch (error) {
    console.error('[FEATURED HISTORY] Error deleting:', error);
    return false;
  }
}
