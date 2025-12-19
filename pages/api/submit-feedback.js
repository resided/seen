// API route to handle user feedback submissions
// Requires transaction signature to prevent spam
// Stores feedback in Redis for admin review

import { getRedisClient } from '../../lib/redis';
import { trackMetric, METRIC_TYPES } from '../../lib/analytics';

const FEEDBACK_KEY_PREFIX = 'feedback:';
const FEEDBACK_LIST_KEY = 'feedback:all';
const RATE_LIMIT_PREFIX = 'feedback:ratelimit:';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fid, walletAddress, message, txHash } = req.body;

  // Validate inputs
  if (!fid || !walletAddress || !message || !txHash) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (typeof fid !== 'number' && typeof fid !== 'string') {
    return res.status(400).json({ error: 'Invalid FID' });
  }

  if (message.length > 500) {
    return res.status(400).json({ error: 'Message too long (max 500 characters)' });
  }

  const redis = await getRedisClient();
  if (!redis) {
    return res.status(500).json({ error: 'Redis unavailable' });
  }

  try {
    const fidNum = typeof fid === 'string' ? parseInt(fid) : fid;

    // Rate limiting: 1 feedback per 24 hours per FID
    const rateLimitKey = `${RATE_LIMIT_PREFIX}${fidNum}`;
    const lastSubmission = await redis.get(rateLimitKey);

    if (lastSubmission) {
      const timeLeft = await redis.ttl(rateLimitKey);
      const hoursLeft = Math.ceil(timeLeft / 3600);
      return res.status(429).json({
        error: `Rate limit: Can submit feedback once per 24h (${hoursLeft}h remaining)`,
      });
    }

    // Create feedback entry
    const timestamp = Date.now();
    const feedbackId = `${timestamp}_${fidNum}`;
    const feedbackKey = `${FEEDBACK_KEY_PREFIX}${feedbackId}`;

    const feedbackData = {
      id: feedbackId,
      fid: fidNum,
      walletAddress,
      message,
      txHash,
      timestamp,
      createdAt: new Date(timestamp).toISOString(),
      status: 'unread', // unread, read, archived
    };

    // Store feedback
    await redis.set(feedbackKey, JSON.stringify(feedbackData));

    // Add to sorted set for chronological ordering (most recent first)
    await redis.zAdd(FEEDBACK_LIST_KEY, {
      score: timestamp,
      value: feedbackId,
    });

    // Set rate limit (24 hours)
    await redis.set(rateLimitKey, timestamp.toString(), { EX: 24 * 60 * 60 });

    console.log('[FEEDBACK] New submission:', {
      id: feedbackId,
      fid: fidNum,
      messageLength: message.length,
    });

    // Track analytics
    await trackMetric(METRIC_TYPES.FEEDBACK_SUBMIT, {
      fid: fidNum,
      feedbackId,
      messageLength: message.length,
    });

    return res.status(200).json({
      success: true,
      feedbackId,
      message: 'Feedback submitted successfully',
    });

  } catch (error) {
    console.error('[FEEDBACK] Submission error:', error);
    return res.status(500).json({ error: 'Failed to submit feedback' });
  }
}
