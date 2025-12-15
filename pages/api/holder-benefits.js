// API route to get holder benefits based on $SEEN balance
import { getTokenBalance, HOLDER_THRESHOLD, HOLDER_DISCOUNT } from '../../lib/token-balance';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address } = req.query;

  if (!address) {
    return res.status(400).json({ error: 'Wallet address required' });
  }

  try {
    const { balance, balanceFormatted, isHolder } = await getTokenBalance(address);

    return res.status(200).json({
      address,
      balance: balanceFormatted,
      isHolder,
      threshold: HOLDER_THRESHOLD,
      benefits: {
        canClaim2x: isHolder,
        featuredDiscount: isHolder ? Math.round(HOLDER_DISCOUNT * 100) : 0,
      },
    });
  } catch (error) {
    console.error('Error fetching holder benefits:', error);
    return res.status(500).json({ error: 'Failed to fetch holder benefits' });
  }
}

