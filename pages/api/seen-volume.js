// API route to get cumulative $SEEN trading volume
// Tracks cumulative volume by accumulating 24h volumes from GeckoTerminal
// Only increases, never decreases

import { getRedisClient } from '../../lib/redis';

const SEEN_POOL_ADDRESS = '0x9ba2ccc022f9b3e07f5685e23bcd472cfbb5fdbf002461d8c503298dc23310ed';
const CUMULATIVE_VOLUME_KEY = 'seen:cumulative:volume';
const LAST_24H_VOLUME_KEY = 'seen:last_24h_volume';
const LAST_UPDATE_KEY = 'seen:volume_last_update';
const BASELINE_VOLUME = 37000; // $37K baseline from Farcaster wallet

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const redis = await getRedisClient();
    let cumulativeVolume = BASELINE_VOLUME;
    let source = 'baseline';

    // Get current cumulative volume from Redis
    if (redis) {
      const storedCumulative = parseFloat(await redis.get(CUMULATIVE_VOLUME_KEY)) || 0;
      // Initialize with baseline if nothing stored yet
      if (storedCumulative === 0 || storedCumulative < BASELINE_VOLUME) {
        cumulativeVolume = BASELINE_VOLUME;
        await redis.set(CUMULATIVE_VOLUME_KEY, BASELINE_VOLUME.toString());
      } else {
        cumulativeVolume = storedCumulative;
      }
    }

    // Fetch 24h volume from GeckoTerminal
    try {
      const geckoTerminalResponse = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/base/pools/${SEEN_POOL_ADDRESS}`,
        {
          headers: { 'Accept': 'application/json' }
        }
      );
      
      if (geckoTerminalResponse.ok) {
        const data = await geckoTerminalResponse.json();
        const pool = data?.data?.attributes;
        
        if (pool) {
          // GeckoTerminal provides volume_usd.h24 for 24h volume
          const volume24h = parseFloat(pool.volume_usd?.h24 || 0);
          
          if (volume24h > 0) {
            source = 'geckoterminal_24h';
            
            if (redis) {
              const last24hVolume = parseFloat(await redis.get(LAST_24H_VOLUME_KEY)) || 0;
              
              // Detect if we've rolled into a new 24h window
              // If current 24h volume is significantly lower than last stored, window rolled over
              // Add the previous 24h volume to cumulative
              if (last24hVolume > 0 && volume24h < last24hVolume * 0.5 && last24hVolume > 100) {
                // New window detected - add previous day's volume to cumulative
                cumulativeVolume += last24hVolume;
                await redis.set(CUMULATIVE_VOLUME_KEY, cumulativeVolume.toString());
                
                console.log('New 24h window detected - added to cumulative:', {
                  previousDayVolume: last24hVolume,
                  newCumulative: cumulativeVolume,
                  current24hVolume: volume24h
                });
              }
              
              // Update current 24h volume tracker (only if it increased or is new)
              if (volume24h > last24hVolume || last24hVolume === 0) {
                await redis.set(LAST_24H_VOLUME_KEY, volume24h.toString());
                await redis.set(LAST_UPDATE_KEY, Date.now().toString());
              }
              
              // Use the updated cumulative volume
              cumulativeVolume = Math.max(cumulativeVolume, parseFloat(await redis.get(CUMULATIVE_VOLUME_KEY)) || BASELINE_VOLUME);
            }
          }
        }
      }
    } catch (err) {
      console.warn('GeckoTerminal volume fetch failed:', err);
      // Fall back to stored cumulative volume
      if (redis) {
        const storedCumulative = parseFloat(await redis.get(CUMULATIVE_VOLUME_KEY)) || BASELINE_VOLUME;
        cumulativeVolume = Math.max(cumulativeVolume, storedCumulative);
        source = 'redis_stored';
      }
    }

    // Ensure volume never decreases
    if (redis) {
      const storedCumulative = parseFloat(await redis.get(CUMULATIVE_VOLUME_KEY)) || BASELINE_VOLUME;
      cumulativeVolume = Math.max(cumulativeVolume, storedCumulative, BASELINE_VOLUME);
      
      // Update if higher
      if (cumulativeVolume > storedCumulative) {
        await redis.set(CUMULATIVE_VOLUME_KEY, cumulativeVolume.toString());
      }
    }

    return res.status(200).json({ 
      cumulativeVolume: Math.round(cumulativeVolume),
      source,
    });

  } catch (error) {
    console.error('Error fetching SEEN volume:', error);
    // Return stored volume or baseline on error
    try {
      const redis = await getRedisClient();
      if (redis) {
        const storedCumulative = parseFloat(await redis.get(CUMULATIVE_VOLUME_KEY)) || BASELINE_VOLUME;
        return res.status(200).json({ 
          cumulativeVolume: Math.round(Math.max(storedCumulative, BASELINE_VOLUME)),
          source: 'redis_fallback',
        });
      }
    } catch (redisErr) {
      // Fall through to baseline
    }
    
    return res.status(200).json({ 
      cumulativeVolume: BASELINE_VOLUME,
      source: 'baseline_fallback',
    });
  }
}

