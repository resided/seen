// API route to fetch and track Farcaster miniapp rankings
// Uses Neynar API to get official Farcaster miniapp data
// Stores daily snapshots to track rank changes

import { getRedisClient } from '../../lib/redis';
import { fetchMiniappRankings } from '../../lib/neynar';

const SNAPSHOT_KEY_PREFIX = 'miniapp:snapshot:';
const LATEST_SNAPSHOT_KEY = 'miniapp:snapshot:latest';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Neynar API key not configured' });
  }

  try {
    const redis = await getRedisClient();

    // Fetch current rankings from Neynar (trending/featured catalog)
    const currentRankings = await fetchMiniappRankings(apiKey);

    if (!currentRankings || currentRankings.length === 0) {
      return res.status(503).json({ error: 'Failed to fetch miniapp rankings from Neynar' });
    }

    // Get previous snapshot to calculate rank changes
    let rankingsWithChanges = currentRankings;

    if (redis) {
      try {
        const previousSnapshotData = await redis.get(LATEST_SNAPSHOT_KEY);

        if (previousSnapshotData) {
          const previousSnapshot = JSON.parse(previousSnapshotData);
          const previousMap = new Map(
            previousSnapshot.rankings.map(app => [app.uuid || app.id, app.rank])
          );

          // Add rank change data
          rankingsWithChanges = currentRankings.map(app => {
            const appId = app.uuid || app.id;
            const previousRank = previousMap.get(appId);
            const rankChange = previousRank ? previousRank - app.rank : 0;

            return {
              ...app,
              previousRank,
              rankChange,
            };
          });
        }

        // Store current snapshot
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const snapshotData = {
          date: today,
          timestamp: Date.now(),
          rankings: currentRankings,
        };

        await redis.set(LATEST_SNAPSHOT_KEY, JSON.stringify(snapshotData));
        await redis.set(`${SNAPSHOT_KEY_PREFIX}${today}`, JSON.stringify(snapshotData));

        // Keep snapshots for 30 days
        await redis.expire(`${SNAPSHOT_KEY_PREFIX}${today}`, 30 * 24 * 60 * 60);

      } catch (redisError) {
        console.error('Redis error:', redisError);
        // Continue without rank changes if Redis fails
      }
    }

    return res.status(200).json({
      rankings: rankingsWithChanges,
      count: rankingsWithChanges.length,
      source: 'neynar',
    });

  } catch (error) {
    console.error('Error fetching miniapp rankings:', error);
    return res.status(500).json({ error: 'Failed to fetch rankings' });
  }
}
