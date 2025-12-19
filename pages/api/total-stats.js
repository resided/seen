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

    // Get all projects from Redis to aggregate stats
    const allProjects = await getAllProjects();

    let totalViews = 0;
    let totalClicks = 0;

    // Sum up views and clicks from all projects
    for (const project of allProjects) {
      if (project.stats) {
        totalViews += project.stats.views || 0;
        totalClicks += project.stats.clicks || 0;
      }
    }

    // Also check for current featured project's stats from Redis
    if (redis) {
      try {
        const CLICKS_KEY = 'clicks:project';
        const VIEWS_KEY = 'views:project';

        // Scan for all click/view keys
        const clickKeys = [];
        const viewKeys = [];
        let cursor = 0;

        do {
          const result = await redis.scan(cursor, {
            MATCH: `${CLICKS_KEY}:*`,
            COUNT: 100,
          });
          cursor = result.cursor;
          clickKeys.push(...result.keys);
        } while (cursor !== 0);

        cursor = 0;
        do {
          const result = await redis.scan(cursor, {
            MATCH: `${VIEWS_KEY}:*`,
            COUNT: 100,
          });
          cursor = result.cursor;
          viewKeys.push(...result.keys);
        } while (cursor !== 0);

        // Sum all click values
        for (const key of clickKeys) {
          const count = await redis.get(key);
          if (count) totalClicks += parseInt(count);
        }

        // Sum all view values
        for (const key of viewKeys) {
          const count = await redis.get(key);
          if (count) totalViews += parseInt(count);
        }
      } catch (redisError) {
        console.error('[STATS] Redis scan error:', redisError);
      }
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
