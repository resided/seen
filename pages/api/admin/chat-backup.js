// Admin API to backup chat messages
import { getChatMessages, getMessageCount } from '../../../lib/chat';
import { isAuthenticated } from '../../../lib/admin-auth';
import { getRedisClient } from '../../../lib/redis';

const ADMIN_FID = 342433;


export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Export/backup messages
    if (!(await isAuthenticated(req))) {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    try {
      const allMessages = await getChatMessages(500); // Get all messages (up to MAX)
      const count = await getMessageCount();

      return res.status(200).json({
        success: true,
        count,
        messages: allMessages,
        exportedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error exporting chat messages:', error);
      return res.status(500).json({ error: 'Failed to export messages', details: error.message });
    }
  } else if (req.method === 'POST') {
    // Restore messages from backup
    if (!(await isAuthenticated(req))) {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    try {
      const { messages, confirm } = req.body;

      if (confirm !== 'RESTORE') {
        return res.status(400).json({ error: 'Must confirm with confirm: "RESTORE"' });
      }

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array is required' });
      }

      const redis = await getRedisClient();
      if (!redis) {
        return res.status(500).json({ error: 'Redis not available' });
      }

      const CHAT_KEY = 'chat:messages';
      let restored = 0;
      let skipped = 0;

      // Restore messages in chronological order (oldest first)
      const sortedMessages = [...messages].sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeA - timeB;
      });

      for (const msg of sortedMessages) {
        try {
          if (!msg.id || !msg.timestamp || !msg.msg) {
            skipped++;
            continue;
          }

          const messageId = msg.id;
          const timestamp = new Date(msg.timestamp).getTime();
          const messageKey = `chat:message:${messageId}`;

          // Check if message already exists
          const exists = await redis.exists(messageKey);
          if (exists) {
            skipped++;
            continue;
          }

          // Store message data as a hash
          await redis.hSet(messageKey, {
            id: messageId.toString(),
            user: msg.user || 'ANON',
            username: msg.username || '',
            fid: (msg.fid || 0).toString(),
            msg: msg.msg,
            verified: (msg.verified || false).toString(),
            timestamp: msg.timestamp,
          });

          // Add to sorted set with timestamp as score
          await redis.zAdd(CHAT_KEY, {
            score: timestamp,
            value: messageId.toString()
          });

          restored++;
        } catch (error) {
          console.error(`Error restoring message ${msg.id}:`, error);
          skipped++;
        }
      }

      return res.status(200).json({
        success: true,
        restored,
        skipped,
        total: messages.length,
      });
    } catch (error) {
      console.error('Error restoring chat messages:', error);
      return res.status(500).json({ error: 'Failed to restore messages', details: error.message });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

