// Admin endpoint to delete/hide chat messages
import { getRedisClient } from '../../../lib/redis';
import { isAuthenticated } from '../../../lib/admin-auth';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check admin authentication
  const authed = await isAuthenticated(req);
  if (!authed) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { messageId } = req.body;

  if (!messageId) {
    return res.status(400).json({ error: 'Message ID required' });
  }

  const redis = await getRedisClient();
  if (!redis) {
    return res.status(500).json({ error: 'Redis unavailable' });
  }

  try {
    // Remove message from sorted set
    const removed = await redis.zRem('chat:messages', messageId.toString());

    // Delete message hash
    await redis.del(`chat:message:${messageId}`);

    console.log(`[ADMIN] Deleted message ${messageId}`);

    return res.status(200).json({
      success: true,
      message: 'Message deleted',
      messageId,
      removed: removed > 0,
    });
  } catch (error) {
    console.error('[ADMIN] Error deleting message:', error);
    return res.status(500).json({
      error: 'Failed to delete message',
      details: error.message,
    });
  }
}
