// Redis connection utility using redis package
import { createClient } from 'redis';

let redis = null;
let isConnecting = false;

/**
 * Get or create Redis client instance
 * @returns {Promise<RedisClient|null>} Redis client or null
 */
export async function getRedisClient() {
  // If we have an open connection, return it
  if (redis && redis.isOpen) {
    return redis;
  }

  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.warn('REDIS_URL not set, chat will use in-memory storage');
    return null;
  }

  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    // Wait a bit and retry
    await new Promise(resolve => setTimeout(resolve, 100));
    return getRedisClient();
  }

  try {
    isConnecting = true;
    
    // If redis exists but is closed, try to reconnect
    if (redis && !redis.isOpen) {
      try {
        await redis.connect();
        isConnecting = false;
        return redis;
      } catch (reconnectError) {
        console.error('Failed to reconnect, creating new client:', reconnectError);
        // If reconnect fails, create a new client
        redis = null;
      }
    }
    
    // Create new client if needed
    if (!redis) {
      redis = createClient({ url: redisUrl });
      
      // Handle errors
      redis.on('error', (err) => {
        console.error('Redis connection error:', err);
      });

      redis.on('connect', () => {
        console.log('Redis connecting...');
      });

      redis.on('ready', () => {
        console.log('Redis connected successfully');
      });
    }

    // Connect to Redis
    if (!redis.isOpen) {
      await redis.connect();
    }

    isConnecting = false;
    return redis;
  } catch (error) {
    console.error('Failed to create Redis client:', error);
    isConnecting = false;
    redis = null;
    return null;
  }
}

/**
 * Close Redis connection
 */
export async function closeRedis() {
  if (redis && redis.isOpen) {
    await redis.quit();
    redis = null;
  }
}
