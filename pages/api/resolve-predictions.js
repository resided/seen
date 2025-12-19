// API route to resolve yesterday's predictions
// Calculates which miniapp gained the most ranks and awards winners

import { getRedisClient } from '../../lib/redis';

const USER_PREDICTION_PREFIX = 'prediction:user:';
const ACTIVE_PREDICTIONS_KEY = 'predictions:active';
const RESULTS_KEY_PREFIX = 'prediction:results:';
const SNAPSHOT_KEY_PREFIX = 'miniapp:snapshot:';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const redis = await getRedisClient();
  if (!redis) {
    return res.status(500).json({ error: 'Redis unavailable' });
  }

  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    // Check if already resolved
    const resultsKey = `${RESULTS_KEY_PREFIX}${yesterdayStr}`;
    const existingResults = await redis.get(resultsKey);
    if (existingResults) {
      return res.status(200).json({
        alreadyResolved: true,
        results: JSON.parse(existingResults),
      });
    }

    // Get yesterday's and today's snapshots
    const yesterdaySnapshotData = await redis.get(`${SNAPSHOT_KEY_PREFIX}${yesterdayStr}`);
    const todaySnapshotData = await redis.get(`${SNAPSHOT_KEY_PREFIX}${todayStr}`);

    if (!yesterdaySnapshotData || !todaySnapshotData) {
      return res.status(400).json({ error: 'Missing snapshot data for comparison' });
    }

    const yesterdaySnapshot = JSON.parse(yesterdaySnapshotData);
    const todaySnapshot = JSON.parse(todaySnapshotData);

    // Calculate rank changes
    const yesterdayMap = new Map(
      yesterdaySnapshot.rankings.map(app => [app.uuid || app.id, app.rank])
    );

    const rankChanges = todaySnapshot.rankings.map(app => {
      const appId = app.uuid || app.id;
      const yesterdayRank = yesterdayMap.get(appId);
      const rankGain = yesterdayRank ? yesterdayRank - app.rank : 0;

      return {
        miniappId: appId,
        miniappName: app.name || app.title,
        yesterdayRank,
        todayRank: app.rank,
        rankGain,
      };
    });

    // Find winner (most ranks gained)
    const winner = rankChanges.reduce((max, app) =>
      app.rankGain > max.rankGain ? app : max
    , rankChanges[0]);

    // Get all predictions for yesterday
    const activePredictionsKey = `${ACTIVE_PREDICTIONS_KEY}:${yesterdayStr}`;
    const predictionKeys = await redis.sMembers(activePredictionsKey);

    // Find winning predictions
    const winners = [];
    for (const predKey of predictionKeys) {
      const predData = await redis.get(predKey);
      if (predData) {
        const prediction = JSON.parse(predData);
        if (prediction.miniappId === winner.miniappId) {
          winners.push(prediction);
        }
      }
    }

    // Save results
    const results = {
      date: yesterdayStr,
      resolvedAt: Date.now(),
      winner: winner,
      totalPredictions: predictionKeys.length,
      winnerCount: winners.length,
      winners: winners.map(w => ({ fid: w.fid, miniappName: w.miniappName })),
      topMovers: rankChanges
        .sort((a, b) => b.rankGain - a.rankGain)
        .slice(0, 5),
    };

    await redis.set(resultsKey, JSON.stringify(results), { EX: 7 * 24 * 60 * 60 }); // Keep for 7 days

    console.log('[RESOLVE] Predictions resolved:', {
      date: yesterdayStr,
      winner: winner.miniappName,
      rankGain: winner.rankGain,
      winners: winners.length,
    });

    return res.status(200).json({
      success: true,
      results,
    });

  } catch (error) {
    console.error('[RESOLVE] Error:', error);
    return res.status(500).json({ error: 'Failed to resolve predictions' });
  }
}
