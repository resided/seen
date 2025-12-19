// API route to get $SEEN token FDV (Fully Diluted Valuation)
// Uses GeckoTerminal API

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

      if (pool && pool.fdv_usd) {
        const fdv = parseFloat(pool.fdv_usd);

        return res.status(200).json({
          fdv,
          source: 'geckoterminal',
        });
      }
    }

    // Fallback if no FDV available
    return res.status(503).json({
      error: 'FDV not available',
      message: 'Unable to fetch $SEEN FDV from GeckoTerminal'
    });
  } catch (error) {
    console.error('Error fetching SEEN FDV:', error);
    return res.status(500).json({ error: 'Failed to fetch FDV' });
  }
}
