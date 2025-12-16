// API route to get $SEEN token price in USD
// Uses GeckoTerminal API for accurate Base network pricing

const SEEN_POOL_ADDRESS = '0x9ba2ccc022f9b3e07f5685e23bcd472cfbb5fdbf002461d8c503298dc23310ed';
const SEEN_TOKEN_ADDRESS = '0x82a56d595cCDFa3A1dc6eEf28d5F0A870f162B07';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Primary: GeckoTerminal API (most accurate for Base pools)
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
        
        if (pool) {
          // Get the token price in USD
          const priceUsd = parseFloat(pool.base_token_price_usd || pool.token_price_usd || '0');
          
          if (priceUsd > 0) {
            return res.status(200).json({ 
              price: priceUsd, 
              source: 'geckoterminal',
              pool: SEEN_POOL_ADDRESS,
              name: pool.name || 'SEEN/WETH',
              volume24h: pool.volume_usd?.h24 || null,
              liquidity: pool.reserve_in_usd || null,
              priceChange24h: pool.price_change_percentage?.h24 || null,
            });
          }
        }
      }
    } catch (geckoTerminalError) {
      console.warn('GeckoTerminal price fetch failed:', geckoTerminalError);
    }

    // Fallback: DEXScreener
    try {
      const dexscreenerResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${SEEN_TOKEN_ADDRESS}`);
      if (dexscreenerResponse.ok) {
        const data = await dexscreenerResponse.json();
        if (data.pairs && data.pairs.length > 0) {
          // Get Base network pairs only, sorted by liquidity
          const basePairs = data.pairs.filter(p => p.chainId === 'base');
          const bestPair = basePairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
          if (bestPair?.priceUsd) {
            return res.status(200).json({ 
              price: parseFloat(bestPair.priceUsd), 
              source: 'dexscreener',
              pairAddress: bestPair.pairAddress,
            });
          }
        }
      }
    } catch (dexscreenerError) {
      console.warn('DEXScreener price fetch failed:', dexscreenerError);
    }

    // No price available
    console.error('No $SEEN price source available');
    return res.status(503).json({ 
      error: 'Price not available',
      message: 'Unable to fetch $SEEN price. GeckoTerminal and DEXScreener both failed.'
    });
  } catch (error) {
    console.error('Error fetching SEEN price:', error);
    return res.status(500).json({ error: 'Failed to fetch price' });
  }
}

