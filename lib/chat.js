// Chat storage using Redis (with in-memory fallback)
import { getRedisClient } from './redis';

const CHAT_KEY = 'chat:messages';
const CHAT_LEADERBOARD_KEY = 'chat:leaderboard'; // Sorted set: FID -> message count
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
 * Get all chat messages from Redis, sorted by oldest first (newest at bottom)
 * @param {number} limit - Maximum number of messages to return
 * @returns {Promise<Array>} - Array of messages with formatted time
 */
export async function getChatMessages(limit = 100) {
  const redis = await getRedisClient();
  
  if (!redis) {
    // Fallback to in-memory - sort oldest first
    return fallbackMessages
      .slice()
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-limit) // Get last N messages (most recent)
      .map(msg => ({
        ...msg,
        time: formatRelativeTime(msg.timestamp),
      }));
  }

  try {
    // Check if chat key exists and get count
    const messageCount = await redis.zCard(CHAT_KEY);
    console.log(`[CHAT] Fetching messages. Total in Redis: ${messageCount}, limit: ${limit}`);
    
    // Get messages from Redis sorted set (sorted by timestamp, ascending - oldest first)
    // We use timestamp as score for sorting
    const messageIds = await redis.zRange(CHAT_KEY, -limit, -1); // Get last N messages (most recent)
    console.log(`[CHAT] Found ${messageIds.length} message IDs from zRange`);
    
    let finalMessageIds = messageIds;
    
    // If zRange returned empty but Redis says messages exist, try full range
    if (messageIds.length === 0 && messageCount > 0) {
      console.error(`[CHAT] ERROR: Redis says ${messageCount} messages exist but zRange returned 0! Trying full range...`);
      // Try getting all messages without limit to debug
      const allIds = await redis.zRange(CHAT_KEY, 0, -1);
      console.error(`[CHAT] Full range returned ${allIds.length} message IDs`);
      if (allIds.length > 0) {
        // Use the full range results instead
        finalMessageIds = allIds.slice(-limit); // Get last N
      }
    }
    
    // Only show fallback if Redis is completely empty (no messages at all)
    if (finalMessageIds.length === 0 && messageCount === 0) {
      console.log(`[CHAT] Redis is completely empty, showing fallback messages`);
      return fallbackMessages
        .slice()
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .slice(-limit)
        .map(msg => ({
          ...msg,
          time: formatRelativeTime(msg.timestamp),
        }));
    }
    
    // If we have message count but no IDs, something is wrong - return empty array, not fallback
    if (finalMessageIds.length === 0 && messageCount > 0) {
      console.error(`[CHAT] CRITICAL: Redis has ${messageCount} messages but we can't retrieve any IDs!`);
      return []; // Return empty, don't show fake fallback messages
    }

    // Get message data for each ID
    const messages = await Promise.all(
      finalMessageIds.map(async (id) => {
        const data = await redis.hGetAll(`chat:message:${id}`);
        if (!data || Object.keys(data).length === 0) {
          console.warn(`[CHAT] Message ${id} hash not found in Redis`);
          return null;
        }
        return {
          id: parseInt(data.id),
          user: data.user,
          username: data.username || null,
          fid: parseInt(data.fid) || 0,
          msg: data.msg,
          verified: data.verified === 'true',
          timestamp: data.timestamp,
          replyToId: data.replyToId ? parseInt(data.replyToId) : null,
          replyToUser: data.replyToUser || null,
          replyToMsg: data.replyToMsg || null,
        };
      })
    );

    const validMessages = messages.filter(Boolean);
    console.log(`[CHAT] Successfully retrieved ${validMessages.length} valid messages out of ${finalMessageIds.length} IDs`);

    // Filter nulls, format, and return (already in ascending order)
    return validMessages
      .map(msg => ({
        ...msg,
        time: formatRelativeTime(msg.timestamp),
      }));
  } catch (error) {
    console.error('Error fetching messages from Redis:', error);
    // Fallback to in-memory - sort oldest first
    return fallbackMessages
      .slice()
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-limit) // Get last N messages (most recent)
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
    // Fallback to in-memory - sort oldest first
    return fallbackMessages
      .filter(msg => new Date(msg.timestamp) > sinceDate)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
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
          replyToId: data.replyToId ? parseInt(data.replyToId) : null,
          replyToUser: data.replyToUser || null,
          replyToMsg: data.replyToMsg || null,
        };
      })
    );

    // Filter, sort (oldest first), and format messages
    return messages
      .filter(Boolean)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
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
    replyToId: messageData.replyToId || null,
    replyToUser: messageData.replyToUser || null,
    replyToMsg: messageData.replyToMsg || null,
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
      replyToId: newMessage.replyToId ? newMessage.replyToId.toString() : '',
      replyToUser: newMessage.replyToUser || '',
      replyToMsg: newMessage.replyToMsg || '',
    });
    
    // Add to sorted set with timestamp as score
    const addResult = await redis.zAdd(CHAT_KEY, {
      score: timestampScore,
      value: messageId.toString()
    });
    
    console.log(`[CHAT] Saved message ${messageId} to Redis. zAdd result: ${addResult}, key: ${CHAT_KEY}`);
    
    // Track message count per user (for leaderboard)
    if (newMessage.fid && newMessage.fid > 0) {
      // Store user info for leaderboard display
      await redis.hSet(`chat:user:${newMessage.fid}`, {
        user: newMessage.user,
        username: newMessage.username || '',
        fid: newMessage.fid.toString(),
        verified: newMessage.verified.toString(),
      });
      // Increment message count in leaderboard sorted set
      const newScore = await redis.zIncrBy(CHAT_LEADERBOARD_KEY, 1, newMessage.fid.toString());
      console.log(`Leaderboard increment: FID ${newMessage.fid} now has score ${newScore}`);
    }
    
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

/**
 * Get chat leaderboard - top users by message count
 * @param {number} limit - Maximum number of users to return (default: 10)
 * @returns {Promise<Array>} - Array of { fid, user, username, verified, messageCount }
 */
export async function getChatLeaderboard(limit = 10) {
  const redis = await getRedisClient();
  
  if (!redis) {
    // Fallback: calculate from in-memory messages
    const counts = {};
    fallbackMessages.forEach(msg => {
      if (msg.fid && msg.fid > 0) {
        if (!counts[msg.fid]) {
          counts[msg.fid] = { fid: msg.fid, user: msg.user, username: msg.username, verified: msg.verified, messageCount: 0 };
        }
        counts[msg.fid].messageCount++;
      }
    });
    return Object.values(counts)
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, limit);
  }

  try {
    // Get top users from leaderboard sorted set (highest scores first)
    // Get members in reverse order (highest scores first)
    const members = await redis.zRange(CHAT_LEADERBOARD_KEY, 0, limit - 1, { REV: true });
    
    if (!members || members.length === 0) {
      return [];
    }
    
    // Get scores for each member
    const topFids = [];
    for (const member of members) {
      const score = await redis.zScore(CHAT_LEADERBOARD_KEY, member);
      topFids.push({ member, score: score || 0 });
    }
    
    console.log('Leaderboard raw data:', JSON.stringify(topFids));

    const leaderboard = [];
    
    // Process each member with its score
    for (const item of topFids) {
      const fid = item.member;
      const messageCount = Number(item.score) || 0;
      
      if (!fid) continue;
      
      const userInfo = await redis.hGetAll(`chat:user:${fid}`);
      
      leaderboard.push({
        fid: parseInt(fid),
        user: userInfo?.user || `FID:${fid}`,
        username: userInfo?.username || null,
        verified: userInfo?.verified === 'true',
        messageCount,
      });
    }

    return leaderboard;
  } catch (error) {
    console.error('Error getting chat leaderboard from Redis:', error);
    return [];
  }
}

/**
 * Clear the leaderboard completely - start fresh from 0
 * @returns {Promise<{success: boolean}>}
 */
export async function clearLeaderboard() {
  const redis = await getRedisClient();
  
  if (!redis) {
    return { success: false, error: 'Redis not available' };
  }

  try {
    // Delete the leaderboard sorted set
    await redis.del(CHAT_LEADERBOARD_KEY);
    
    // Delete all user info keys (they'll be recreated on next message)
    const userKeys = await redis.keys('chat:user:*');
    if (userKeys && userKeys.length > 0) {
      for (const key of userKeys) {
        await redis.del(key);
      }
    }
    
    console.log('Leaderboard cleared - starting fresh');
    return { success: true };
  } catch (error) {
    console.error('Error clearing leaderboard:', error);
    return { success: false, error: error.message };
  }
}
