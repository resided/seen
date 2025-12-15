// API route to get holder benefits based on $SEEN balance
import { getTokenBalance, HOLDER_TIERS } from '../../lib/token-balance';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address } = req.query;

  if (!address) {
    return res.status(400).json({ error: 'Wallet address required' });
  }

  try {
    const { balance, balanceFormatted, tier } = await getTokenBalance(address);

    // Return all tier info for UI display
    return res.status(200).json({
      address,
      balance: balanceFormatted,
      tier: tier.label,
      benefits: {
        claimMultiplier: tier.claimMultiplier,
        featuredDiscount: tier.featuredDiscount,
        featuredDiscountPercent: Math.round(tier.featuredDiscount * 100),
      },
      tiers: {
        WHALE: { 
          minBalance: HOLDER_TIERS.WHALE.minBalance, 
          claimMultiplier: HOLDER_TIERS.WHALE.claimMultiplier,
          featuredDiscount: Math.round(HOLDER_TIERS.WHALE.featuredDiscount * 100),
        },
        DOLPHIN: { 
          minBalance: HOLDER_TIERS.DOLPHIN.minBalance, 
          claimMultiplier: HOLDER_TIERS.DOLPHIN.claimMultiplier,
          featuredDiscount: Math.round(HOLDER_TIERS.DOLPHIN.featuredDiscount * 100),
        },
        HOLDER: { 
          minBalance: HOLDER_TIERS.HOLDER.minBalance, 
          claimMultiplier: HOLDER_TIERS.HOLDER.claimMultiplier,
          featuredDiscount: Math.round(HOLDER_TIERS.HOLDER.featuredDiscount * 100),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching holder benefits:', error);
    return res.status(500).json({ error: 'Failed to fetch holder benefits' });
  }
}

