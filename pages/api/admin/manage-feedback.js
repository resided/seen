// Admin API route to manage feedback (acknowledge, flag, delete)
// Protected by admin authentication

import { getRedisClient } from '../../../lib/redis';
import { isAuthenticated } from '../../../lib/admin-auth';

const FEEDBACK_KEY_PREFIX = 'feedback:';
const FEEDBACK_LIST_KEY = 'feedback:all';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check admin authentication
  if (!(await isAuthenticated(req))) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const redis = await getRedisClient();
  if (!redis) {
    return res.status(500).json({ error: 'Redis unavailable' });
  }

  const { id, action } = req.body;

  if (!id || !action) {
    return res.status(400).json({ error: 'Missing id or action' });
  }

  try {
    const feedbackKey = `${FEEDBACK_KEY_PREFIX}${id}`;
    const feedbackData = await redis.get(feedbackKey);

    if (!feedbackData) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    const feedback = JSON.parse(feedbackData);

    // Handle different actions
    switch (action) {
      case 'acknowledge':
        feedback.status = 'acknowledged';
        feedback.acknowledgedAt = Date.now();
        await redis.set(feedbackKey, JSON.stringify(feedback));
        console.log(`[ADMIN] Feedback ${id} acknowledged`);
        return res.status(200).json({
          success: true,
          message: 'Feedback acknowledged',
          feedback,
        });

      case 'flag':
        feedback.status = 'flagged';
        feedback.flaggedAt = Date.now();
        await redis.set(feedbackKey, JSON.stringify(feedback));
        console.log(`[ADMIN] Feedback ${id} flagged`);
        return res.status(200).json({
          success: true,
          message: 'Feedback flagged',
          feedback,
        });

      case 'delete':
        // Remove from Redis
        await redis.del(feedbackKey);
        // Remove from sorted set
        await redis.zRem(FEEDBACK_LIST_KEY, id);
        console.log(`[ADMIN] Feedback ${id} deleted`);
        return res.status(200).json({
          success: true,
          message: 'Feedback deleted',
        });

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

  } catch (error) {
    console.error('[ADMIN] Feedback management error:', error);
    return res.status(500).json({ error: 'Failed to manage feedback' });
  }
}
