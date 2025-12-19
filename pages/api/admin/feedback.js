// Admin API route to view all feedback submissions
// Protected by admin FID check

import { getRedisClient } from '../../../lib/redis';

const FEEDBACK_KEY_PREFIX = 'feedback:';
const FEEDBACK_LIST_KEY = 'feedback:all';

// Admin FIDs (replace with your actual admin FIDs)
const ADMIN_FIDS = [
  parseInt(process.env.ADMIN_FID || '0'),
  // Add more admin FIDs here
].filter(fid => fid > 0);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check admin authentication
  const { fid } = req.query;
  const fidNum = parseInt(fid);

  if (!fid || !ADMIN_FIDS.includes(fidNum)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const redis = await getRedisClient();
  if (!redis) {
    return res.status(500).json({ error: 'Redis unavailable' });
  }

  try {
    const { status = 'all', limit = 100 } = req.query;

    // Get all feedback IDs sorted by timestamp (most recent first)
    const feedbackIds = await redis.zRange(FEEDBACK_LIST_KEY, 0, -1, { REV: true });

    if (!feedbackIds || feedbackIds.length === 0) {
      return res.status(200).json({
        feedback: [],
        count: 0,
      });
    }

    // Fetch feedback data
    const feedbackPromises = feedbackIds.slice(0, parseInt(limit)).map(async (id) => {
      const data = await redis.get(`${FEEDBACK_KEY_PREFIX}${id}`);
      return data ? JSON.parse(data) : null;
    });

    const allFeedback = (await Promise.all(feedbackPromises)).filter(Boolean);

    // Filter by status if specified
    const filteredFeedback = status === 'all'
      ? allFeedback
      : allFeedback.filter(f => f.status === status);

    return res.status(200).json({
      feedback: filteredFeedback,
      count: filteredFeedback.length,
      total: allFeedback.length,
    });

  } catch (error) {
    console.error('[ADMIN] Feedback fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch feedback' });
  }
}
