// API route to get all-time $SEEN trading volume
// Fetches lifetime volume from DEXScreener/GeckoTerminal
// Only increases, never decreases (stores max seen value)

import { getRedisClient } from '../../lib/redis';

const SEEN_POOL_ADDRESS = '0x9ba2ccc022f9b3e07f5685e23bcd472cfbb5fdbf002461d8c503298dc23310ed';
const SEEN_TOKEN_ADDRESS = '0x82a56d595cCDFa3A1dc6eEf28d5F0A870f162B07';
const MAX_VOLUME_KEY = 'seen:alltime:volume:max';

// Known baseline volume (verified from Farcaster wallet/DEX data)
const BASELINE_VOLUME = 33000; // $33K verified all-time volume

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const redis = await getRedisClient();
    let allTimeVolume = BASELINE_VOLUME; // Start with known baseline
    let source = 'baseline';

    // Try DEXScreener first
    try {
      const dexscreenerResponse = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${SEEN_TOKEN_ADDRESS}`
      );
      
      if (dexscreenerResponse.ok) {
        const data = await dexscreenerResponse.json();
        if (data.pairs && data.pairs.length > 0) {
          // Get Base network pairs and sum their volumes
          const basePairs = data.pairs.filter(p => p.chainId === 'base');
          
          // Sum total volume across all pairs
          let totalVolume = 0;
          for (const pair of basePairs) {
            // DEXScreener might have total volume in different fields
            const pairVolume = parseFloat(pair.volume?.all || pair.volumeAll || 0);
            if (pairVolume > 0) {
              totalVolume += pairVolume;
            }
          }
          
          if (totalVolume > allTimeVolume) {
            allTimeVolume = totalVolume;
            source = 'dexscreener_total';
          }
          
          // If no total volume, check for txns count and estimate
          if (totalVolume === 0) {
            const mainPair = basePairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
            if (mainPair) {
              // Use txns count if available to estimate volume
              const txns24h = (mainPair.txns?.h24?.buys || 0) + (mainPair.txns?.h24?.sells || 0);
              const volume24h = parseFloat(mainPair.volume?.h24 || 0);
              
              // Average tx size
              const avgTxSize = txns24h > 0 ? volume24h / txns24h : 50;
              
              // Total transactions might indicate lifetime activity
              const totalTxns = mainPair.txns?.all || mainPair.totalTxns || 0;
              if (totalTxns > 0) {
                const estimatedTotal = totalTxns * avgTxSize;
                if (estimatedTotal > allTimeVolume) {
                  allTimeVolume = estimatedTotal;
                  source = 'dexscreener_txns';
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('DEXScreener volume fetch failed:', err);
    }

    // Try GeckoTerminal for lifetime volume
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
          // Check for lifetime/all-time volume fields
          const lifetimeVol = parseFloat(
            pool.lifetime_volume_usd || 
            pool.all_time_volume_usd || 
            pool.total_volume_usd ||
            pool.volume_usd?.all ||
            0
          );
          
          if (lifetimeVol > allTimeVolume) {
            allTimeVolume = lifetimeVol;
            source = 'geckoterminal_lifetime';
          }
        }
      }
    } catch (err) {
      console.warn('GeckoTerminal volume fetch failed:', err);
    }

    // Store max seen volume in Redis (only increases)
    if (redis) {
      const storedMax = parseFloat(await redis.get(MAX_VOLUME_KEY)) || 0;
      
      // Always use the maximum of: fetched volume, stored max, or baseline
      allTimeVolume = Math.max(allTimeVolume, storedMax, BASELINE_VOLUME);
      
      if (allTimeVolume > storedMax) {
        await redis.set(MAX_VOLUME_KEY, allTimeVolume.toString());
      }
    }

    return res.status(200).json({ 
      cumulativeVolume: Math.round(allTimeVolume),
      source,
    });

  } catch (error) {
    console.error('Error fetching SEEN volume:', error);
    // Return baseline on error
    return res.status(200).json({ 
      cumulativeVolume: BASELINE_VOLUME,
      source: 'baseline_fallback',
    });
  }
}

