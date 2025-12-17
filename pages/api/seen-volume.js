// API route to get cumulative $SEEN trading volume
// Only increases, never decreases (tracks all-time volume)

import { getRedisClient } from '../../lib/redis';

const SEEN_POOL_ADDRESS = '0x9ba2ccc022f9b3e07f5685e23bcd472cfbb5fdbf002461d8c503298dc23310ed';
const VOLUME_KEY = 'seen:cumulative:volume';
const LAST_24H_KEY = 'seen:last:24h:volume';
const LAST_CHECK_KEY = 'seen:last:volume:check';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const redis = await getRedisClient();
    
    // Get current 24h volume from GeckoTerminal
    let current24hVolume = 0;
    try {
      const geckoTerminalResponse = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/base/pools/${SEEN_POOL_ADDRESS}`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );
      
      if (geckoTerminalResponse.ok) {
        const data = await geckoTerminalResponse.json();
        const pool = data?.data?.attributes;
        if (pool?.volume_usd?.h24) {
          current24hVolume = parseFloat(pool.volume_usd.h24) || 0;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch volume from GeckoTerminal:', err);
    }

    if (!redis) {
      // No Redis, just return current 24h volume
      return res.status(200).json({ 
        cumulativeVolume: current24hVolume,
        source: 'geckoterminal',
        current24h: current24hVolume,
      });
    }

    // Get stored values
    const [storedCumulative, storedLast24h, lastCheckTime] = await Promise.all([
      redis.get(VOLUME_KEY),
      redis.get(LAST_24H_KEY),
      redis.get(LAST_CHECK_KEY),
    ]);

    let cumulativeVolume = parseFloat(storedCumulative) || 0;
    const previousLast24h = parseFloat(storedLast24h) || 0;
    const lastCheck = parseInt(lastCheckTime) || 0;
    const now = Date.now();
    
    // Initialize cumulative volume if not set (seed with reasonable starting value)
    if (cumulativeVolume === 0 && current24hVolume > 0) {
      // Start with 10x the current 24h volume as a base (approximate historical)
      cumulativeVolume = current24hVolume * 10;
      await redis.set(VOLUME_KEY, cumulativeVolume.toString());
    }

    // Only update every 5 minutes to avoid excessive writes
    const FIVE_MINUTES = 5 * 60 * 1000;
    if (now - lastCheck > FIVE_MINUTES) {
      // If 24h volume increased since last check, add the difference to cumulative
      // This captures new trading activity
      if (current24hVolume > previousLast24h) {
        const volumeIncrease = current24hVolume - previousLast24h;
        cumulativeVolume += volumeIncrease;
        await redis.set(VOLUME_KEY, cumulativeVolume.toString());
      }
      
      // If 24h volume is lower than before, it means a new 24h window started
      // In this case, add the current volume (new day's trading)
      if (current24hVolume < previousLast24h * 0.5 && current24hVolume > 0) {
        // Likely a new day - add current volume
        cumulativeVolume += current24hVolume;
        await redis.set(VOLUME_KEY, cumulativeVolume.toString());
      }

      // Update last seen 24h volume and check time
      await Promise.all([
        redis.set(LAST_24H_KEY, current24hVolume.toString()),
        redis.set(LAST_CHECK_KEY, now.toString()),
      ]);
    }

    return res.status(200).json({ 
      cumulativeVolume: Math.round(cumulativeVolume),
      current24h: Math.round(current24hVolume),
      source: 'geckoterminal',
    });

  } catch (error) {
    console.error('Error fetching SEEN volume:', error);
    return res.status(500).json({ error: 'Failed to fetch volume' });
  }
}

