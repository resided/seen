// API route for miniapp prediction market
// Users predict which Farcaster miniapp will gain the most ranks

import { getRedisClient } from '../../lib/redis';

const PREDICTION_KEY_PREFIX = 'prediction:';
const ACTIVE_PREDICTIONS_KEY = 'predictions:active';
const USER_PREDICTION_PREFIX = 'prediction:user:';
const PREDICTION_STATS_PREFIX = 'prediction:stats:';

export default async function handler(req, res) {
  const redis = await getRedisClient();
  if (!redis) {
    return res.status(500).json({ error: 'Redis unavailable' });
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // GET = Check user's prediction status
  if (req.method === 'GET') {
    const { fid } = req.query;

    if (!fid) {
      return res.status(400).json({ error: 'FID required' });
    }

    try {
      // Check if user has predicted today
      const userPredictionKey = `${USER_PREDICTION_PREFIX}${today}:${fid}`;
      const prediction = await redis.get(userPredictionKey);

      // Get prediction stats (how many predicted each app)
      const statsKey = `${PREDICTION_STATS_PREFIX}${today}`;
      const stats = await redis.hGetAll(statsKey);

      return res.status(200).json({
        hasPredicted: !!prediction,
        prediction: prediction ? JSON.parse(prediction) : null,
        stats: stats || {},
        date: today,
      });
    } catch (error) {
      console.error('[PREDICT] GET error:', error);
      return res.status(500).json({ error: 'Failed to fetch prediction status' });
    }
  }

  // POST = Submit prediction
  if (req.method === 'POST') {
    const { fid, miniappId, miniappName, currentRank } = req.body;

    // Validate
    if (!fid || !miniappId || !miniappName) {
      return res.status(400).json({ error: 'FID, miniappId, and miniappName required' });
    }

    const fidNum = parseInt(fid);
    if (isNaN(fidNum) || fidNum <= 0) {
      return res.status(400).json({ error: 'Invalid FID' });
    }

    try {
      // Check if user already predicted today
      const userPredictionKey = `${USER_PREDICTION_PREFIX}${today}:${fidNum}`;
      const existing = await redis.get(userPredictionKey);

      if (existing) {
        return res.status(400).json({
          error: 'Already predicted today',
          prediction: JSON.parse(existing),
        });
      }

      // Store prediction
      const predictionData = {
        fid: fidNum,
        miniappId,
        miniappName,
        currentRank,
        predictedAt: Date.now(),
        date: today,
      };

      // Set user's prediction (expires in 48 hours)
      await redis.set(
        userPredictionKey,
        JSON.stringify(predictionData),
        { EX: 48 * 60 * 60 }
      );

      // Update prediction stats (how many users predicted this app)
      const statsKey = `${PREDICTION_STATS_PREFIX}${today}`;
      await redis.hIncrBy(statsKey, miniappId, 1);
      await redis.expire(statsKey, 48 * 60 * 60);

      // Add to active predictions list for resolution
      const activePredictionsKey = `${ACTIVE_PREDICTIONS_KEY}:${today}`;
      await redis.sAdd(activePredictionsKey, userPredictionKey);
      await redis.expire(activePredictionsKey, 48 * 60 * 60);

      console.log('[PREDICT] Prediction submitted:', {
        fid: fidNum,
        miniappName,
        date: today,
      });

      return res.status(200).json({
        success: true,
        prediction: predictionData,
      });

    } catch (error) {
      console.error('[PREDICT] POST error:', error);
      return res.status(500).json({ error: 'Failed to submit prediction' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
