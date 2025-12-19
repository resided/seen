// API route to get $SEEN token 24h trading volume
// Uses GeckoTerminal API for real-time volume data

const SEEN_POOL_ADDRESS = '0x9ba2ccc022f9b3e07f5685e23bcd472cfbb5fdbf002461d8c503298dc23310ed';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

      if (pool && pool.volume_usd?.h24) {
        const volume24h = parseFloat(pool.volume_usd.h24);

        return res.status(200).json({
          volume24h,
          source: 'geckoterminal',
        });
      }
    }

    // Fallback if no volume available
    return res.status(503).json({
      error: 'Volume not available',
      message: 'Unable to fetch $SEEN volume from GeckoTerminal'
    });
  } catch (error) {
    console.error('Error fetching SEEN volume:', error);
    return res.status(500).json({ error: 'Failed to fetch volume' });
  }
}
