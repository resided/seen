// Rate limiting utility using Redis
import { getRedisClient } from './redis';

/**
 * Rate limit check
 * @param {string} identifier - Unique identifier (IP address, FID, etc.)
 * @param {number} maxRequests - Maximum requests allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Promise<{ allowed: boolean, remaining: number, resetAt: number }>}
 */
export async function checkRateLimit(identifier, maxRequests = 10, windowMs = 60000) {
  const redis = await getRedisClient();
  const key = `ratelimit:${identifier}`;
  const now = Date.now();
  
  if (!redis) {
    // If Redis is unavailable, allow the request (fallback)
    // In production, you might want to be more strict
    return { allowed: true, remaining: maxRequests, resetAt: now + windowMs };
  }

  try {
    // Get current count
    const count = await redis.get(key);
    const currentCount = count ? parseInt(count) : 0;
    
    if (currentCount >= maxRequests) {
      // Rate limit exceeded
      const ttl = await redis.ttl(key);
      return {
        allowed: false,
        remaining: 0,
        resetAt: now + (ttl * 1000),
      };
    }
    
    // Increment counter
    if (currentCount === 0) {
      // First request in this window, set with expiration
      await redis.setEx(key, Math.ceil(windowMs / 1000), '1');
    } else {
      // Increment existing counter
      await redis.incr(key);
    }
    
    const newCount = currentCount + 1;
    const ttl = await redis.ttl(key);
    
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - newCount),
      resetAt: now + (ttl * 1000),
    };
  } catch (error) {
    console.error('Rate limit error:', error);
    // On error, allow the request (fail open)
    return { allowed: true, remaining: maxRequests, resetAt: now + windowMs };
  }
}

/**
 * Get client IP from request
 * @param {Object} req - Request object
 * @returns {string} - IP address
 */
export function getClientIP(req) {
  // Check various headers for IP (handles proxies/load balancers)
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const cfConnectingIP = req.headers['cf-connecting-ip']; // Cloudflare
  
  if (cfConnectingIP) {
    return cfConnectingIP.split(',')[0].trim();
  }
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  // Fallback to connection remote address
  return req.socket?.remoteAddress || 'unknown';
}
