// API route to get $SEEN token price in USD
// This fetches price from a DEX aggregator or other source

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Option 1: Try CoinGecko (if SEEN is listed)
    try {
      const coingeckoResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=seen&vs_currencies=usd');
      if (coingeckoResponse.ok) {
        const data = await coingeckoResponse.json();
        if (data.seen?.usd) {
          return res.status(200).json({ price: data.seen.usd, source: 'coingecko' });
        }
      }
    } catch (coingeckoError) {
      console.warn('CoinGecko price fetch failed:', coingeckoError);
    }

    // Option 2: Try DEX aggregator (e.g., Uniswap, 1inch, etc.)
    // For Base network, you might use:
    // - Uniswap V3 subgraph
    // - 1inch API
    // - DEXScreener API
    
    // Example: Try DEXScreener (if SEEN has a pair)
    try {
      const SEEN_TOKEN_ADDRESS = '0x82a56d595cCDFa3A1dc6eEf28d5F0A870f162B07';
      const dexscreenerResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${SEEN_TOKEN_ADDRESS}`);
      if (dexscreenerResponse.ok) {
        const data = await dexscreenerResponse.json();
        if (data.pairs && data.pairs.length > 0) {
          // Get the most liquid pair (highest liquidity)
          const bestPair = data.pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
          if (bestPair?.priceUsd) {
            return res.status(200).json({ 
              price: parseFloat(bestPair.priceUsd), 
              source: 'dexscreener' 
            });
          }
        }
      }
    } catch (dexscreenerError) {
      console.warn('DEXScreener price fetch failed:', dexscreenerError);
    }

    // Option 3: Fallback - return null or a default
    // You should implement a proper price source
    console.error('No $SEEN price source available');
    return res.status(503).json({ 
      error: 'Price not available',
      message: 'Unable to fetch $SEEN price from any source. Please implement a price API.'
    });
  } catch (error) {
    console.error('Error fetching SEEN price:', error);
    return res.status(500).json({ error: 'Failed to fetch price' });
  }
}

