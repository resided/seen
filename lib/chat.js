// Chat storage using Redis (with in-memory fallback)
import { getRedisClient } from './redis';

const CHAT_KEY = 'chat:messages';
const MAX_MESSAGES = 500; // Keep last 500 messages

// In-memory fallback storage
let fallbackMessages = [
  {
    id: 1,
    user: 'DWR.ETH',
    fid: 3,
    msg: 'THIS IS EXACTLY WHAT WE NEEDED',
    verified: true,
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
  {
    id: 2,
    user: 'VITALIK.ETH',
    fid: 5650,
    msg: 'CLEAN UX. MINTED 3 ALREADY',
    verified: true,
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: 3,
    user: 'JESSE.BASE',
    fid: 99,
    msg: 'HOW DO I LIST MY APP HERE?',
    verified: false,
    timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  },
  {
    id: 4,
    user: 'BUILDER.ETH',
    fid: 421,
    msg: 'FINALLY A PLACE FOR DISCOVERY',
    verified: false,
    timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    id: 5,
    user: 'ANON',
    fid: 8821,
    msg: 'NEED MORE GAMES CATEGORY',
    verified: false,
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
];

// Format relative time (e.g., "2M", "5M", "NOW")
function formatRelativeTime(timestamp) {
  const now = new Date();
  const msgTime = new Date(timestamp);
  const diffMs = now - msgTime;
  const diffMins = Math.floor(diffMs / 60000);
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 30) return 'NOW';
  if (diffMins < 1) return `${diffSecs}S`;
  if (diffMins < 60) return `${diffMins}M`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}H`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}D`;
}

/**
 * Get all chat messages from Redis, sorted by most recent first
 * @param {number} limit - Maximum number of messages to return
 * @returns {Promise<Array>} - Array of messages with formatted time
 */
export async function getChatMessages(limit = 100) {
  const redis = await getRedisClient();
  
  if (!redis) {
    // Fallback to in-memory
    return fallbackMessages
      .slice()
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit)
      .map(msg => ({
        ...msg,
        time: formatRelativeTime(msg.timestamp),
      }));
  }

  try {
    // Get messages from Redis sorted set (sorted by timestamp, descending)
    // We use timestamp as score for sorting
    const messageIds = await redis.zRange(CHAT_KEY, 0, limit - 1, { REV: true });
    
    if (messageIds.length === 0) {
      return [];
    }

    // Get message data for each ID
    const messages = await Promise.all(
      messageIds.map(async (id) => {
        const data = await redis.hGetAll(`chat:message:${id}`);
        if (!data || Object.keys(data).length === 0) return null;
        return {
          id: parseInt(data.id),
          user: data.user,
          username: data.username || null,
          fid: parseInt(data.fid) || 0,
          msg: data.msg,
          verified: data.verified === 'true',
          timestamp: data.timestamp,
        };
      })
    );

    // Filter nulls, format, and return
    return messages
      .filter(Boolean)
      .map(msg => ({
        ...msg,
        time: formatRelativeTime(msg.timestamp),
      }));
  } catch (error) {
    console.error('Error fetching messages from Redis:', error);
    // Fallback to in-memory
    return fallbackMessages
      .slice()
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit)
      .map(msg => ({
        ...msg,
        time: formatRelativeTime(msg.timestamp),
      }));
  }
}

/**
 * Get messages after a specific timestamp (for polling)
 * @param {string} since - ISO timestamp
 * @returns {Promise<Array>} - Array of new messages
 */
export async function getChatMessagesSince(since) {
  const redis = await getRedisClient();
  const sinceDate = new Date(since);
  const sinceScore = sinceDate.getTime();

  if (!redis) {
    // Fallback to in-memory
    return fallbackMessages
      .filter(msg => new Date(msg.timestamp) > sinceDate)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .map(msg => ({
        ...msg,
        time: formatRelativeTime(msg.timestamp),
      }));
  }

  try {
    // Get messages with score (timestamp) greater than sinceScore
    // Use timestamp as score for efficient range queries
    const messageIds = await redis.zRangeByScore(
      CHAT_KEY,
      sinceScore + 1, // +1 to exclude the since message itself
      '+inf',
      {
        LIMIT: {
          offset: 0,
          count: 100
        }
      }
    );

    if (messageIds.length === 0) {
      return [];
    }

    // Get message data
    const messages = await Promise.all(
      messageIds.map(async (id) => {
        const data = await redis.hGetAll(`chat:message:${id}`);
        if (!data || Object.keys(data).length === 0) return null;
        return {
          id: parseInt(data.id),
          user: data.user,
          username: data.username || null,
          fid: parseInt(data.fid) || 0,
          msg: data.msg,
          verified: data.verified === 'true',
          timestamp: data.timestamp,
        };
      })
    );

    // Filter, sort, and format messages
    return messages
      .filter(Boolean)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .map(msg => ({
        ...msg,
        time: formatRelativeTime(msg.timestamp),
      }));
  } catch (error) {
    console.error('Error fetching messages since timestamp from Redis:', error);
    // Fallback to in-memory
    return fallbackMessages
      .filter(msg => new Date(msg.timestamp) > sinceDate)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .map(msg => ({
        ...msg,
        time: formatRelativeTime(msg.timestamp),
      }));
  }
}

/**
 * Add a new chat message
 * @param {Object} messageData - Message data
 * @param {string} messageData.msg - Message text
 * @param {string} messageData.user - Display name
 * @param {string} messageData.username - Farcaster username (optional, for profile URLs)
 * @param {number} messageData.fid - Farcaster ID (optional)
 * @param {boolean} messageData.verified - Whether user is verified (optional)
 * @returns {Promise<Object>} - Created message
 */
export async function addChatMessage(messageData) {
  const { msg, user, username = null, fid = 0, verified = false } = messageData;
  const redis = await getRedisClient();
  
  const messageId = Date.now();
  const timestamp = new Date().toISOString();
  const timestampScore = messageId; // Use messageId as score (milliseconds since epoch)
  
  const newMessage = {
    id: messageId,
    user: user || 'ANON',
    username: username || null,
    fid: fid || 0,
    msg: msg.toUpperCase(),
    verified: verified || false,
    timestamp,
  };

  if (!redis) {
    // Fallback to in-memory
    fallbackMessages.unshift(newMessage);
    if (fallbackMessages.length > MAX_MESSAGES) {
      fallbackMessages = fallbackMessages.slice(0, MAX_MESSAGES);
    }
    return {
      ...newMessage,
      time: formatRelativeTime(newMessage.timestamp),
    };
  }

  try {
    // Store message in Redis
    const messageKey = `chat:message:${messageId}`;
    
    // Store message data as a hash
    await redis.hSet(messageKey, {
      id: messageId.toString(),
      user: newMessage.user,
      username: newMessage.username || '',
      fid: newMessage.fid.toString(),
      msg: newMessage.msg,
      verified: newMessage.verified.toString(),
      timestamp: newMessage.timestamp,
    });
    
    // Add to sorted set with timestamp as score
    await redis.zAdd(CHAT_KEY, {
      score: timestampScore,
      value: messageId.toString()
    });
    
    // Keep only last MAX_MESSAGES messages
    const totalMessages = await redis.zCard(CHAT_KEY);
    if (totalMessages > MAX_MESSAGES) {
      // Remove oldest messages (lowest scores)
      const toRemove = totalMessages - MAX_MESSAGES;
      const oldestIds = await redis.zRange(CHAT_KEY, 0, toRemove - 1);
      if (oldestIds.length > 0) {
        // Delete the message hashes and remove from sorted set
        const pipeline = redis.multi();
        oldestIds.forEach(id => {
          pipeline.del(`chat:message:${id}`);
          pipeline.zRem(CHAT_KEY, id);
        });
        await pipeline.exec();
      }
    }

    return {
      ...newMessage,
      time: formatRelativeTime(newMessage.timestamp),
    };
  } catch (error) {
    console.error('Error adding message to Redis:', error);
    // Fallback to in-memory
    fallbackMessages.unshift(newMessage);
    if (fallbackMessages.length > MAX_MESSAGES) {
      fallbackMessages = fallbackMessages.slice(0, MAX_MESSAGES);
    }
    return {
      ...newMessage,
      time: formatRelativeTime(newMessage.timestamp),
    };
  }
}

/**
 * Get message count
 * @returns {Promise<number>}
 */
export async function getMessageCount() {
  const redis = await getRedisClient();
  
  if (!redis) {
    return fallbackMessages.length;
  }

  try {
    return await redis.zCard(CHAT_KEY);
  } catch (error) {
    console.error('Error getting message count from Redis:', error);
    return fallbackMessages.length;
  }
}
