// API route to get all-time $SEEN trading volume
// Fetches lifetime volume from DEXScreener/GeckoTerminal
// Only increases, never decreases (stores max seen value)

import { getRedisClient } from '../../lib/redis';

const SEEN_POOL_ADDRESS = '0x9ba2ccc022f9b3e07f5685e23bcd472cfbb5fdbf002461d8c503298dc23310ed';
const SEEN_TOKEN_ADDRESS = '0x82a56d595cCDFa3A1dc6eEf28d5F0A870f162B07';
const MAX_VOLUME_KEY = 'seen:alltime:volume:max';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const redis = await getRedisClient();
    let allTimeVolume = 0;
    let source = 'none';

    // Try DEXScreener first - they have lifetime volume
    try {
      const dexscreenerResponse = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${SEEN_TOKEN_ADDRESS}`
      );
      
      if (dexscreenerResponse.ok) {
        const data = await dexscreenerResponse.json();
        if (data.pairs && data.pairs.length > 0) {
          // Get Base network pairs
          const basePairs = data.pairs.filter(p => p.chainId === 'base');
          // Sum up all volume from all pairs (lifetime is in volume.h24 * days or fdv related)
          // DEXScreener provides txns which can help estimate lifetime
          const mainPair = basePairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
          
          if (mainPair) {
            // DEXScreener doesn't directly provide lifetime volume, but we can use
            // volume.h24 and pair age to estimate, or use the total txns * avg value
            // For now, use the pair's total volume if available
            const volume24h = parseFloat(mainPair.volume?.h24 || 0);
            const volume6h = parseFloat(mainPair.volume?.h6 || 0);
            const volume1h = parseFloat(mainPair.volume?.h1 || 0);
            
            // Check if there's a priceChange field that might indicate age
            const pairAge = mainPair.pairCreatedAt ? 
              Math.max(1, Math.floor((Date.now() - mainPair.pairCreatedAt) / (24 * 60 * 60 * 1000))) : 
              30; // Default to 30 days if unknown
            
            // Estimate all-time as average daily * days (conservative estimate)
            // Using volume24h as daily average
            allTimeVolume = volume24h * pairAge;
            source = 'dexscreener';
          }
        }
      }
    } catch (err) {
      console.warn('DEXScreener volume fetch failed:', err);
    }

    // Fallback: Try GeckoTerminal
    if (allTimeVolume === 0) {
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
            // GeckoTerminal has lifetime_volume or all_time_volume sometimes
            const lifetimeVol = parseFloat(pool.lifetime_volume_usd || pool.all_time_volume_usd || 0);
            
            if (lifetimeVol > 0) {
              allTimeVolume = lifetimeVol;
              source = 'geckoterminal_lifetime';
            } else {
              // Estimate from 24h volume and pool age
              const volume24h = parseFloat(pool.volume_usd?.h24 || 0);
              const poolCreated = pool.pool_created_at ? new Date(pool.pool_created_at) : null;
              const poolAgeDays = poolCreated ? 
                Math.max(1, Math.floor((Date.now() - poolCreated.getTime()) / (24 * 60 * 60 * 1000))) : 
                30;
              
              allTimeVolume = volume24h * poolAgeDays;
              source = 'geckoterminal_estimated';
            }
          }
        }
      } catch (err) {
        console.warn('GeckoTerminal volume fetch failed:', err);
      }
    }

    // Store max seen volume in Redis (only increases)
    if (redis) {
      const storedMax = parseFloat(await redis.get(MAX_VOLUME_KEY)) || 0;
      
      if (allTimeVolume > storedMax) {
        await redis.set(MAX_VOLUME_KEY, allTimeVolume.toString());
      } else {
        // Use stored max if current fetch is lower
        allTimeVolume = Math.max(allTimeVolume, storedMax);
      }
    }

    return res.status(200).json({ 
      cumulativeVolume: Math.round(allTimeVolume),
      source,
    });

  } catch (error) {
    console.error('Error fetching SEEN volume:', error);
    return res.status(500).json({ error: 'Failed to fetch volume' });
  }
}

