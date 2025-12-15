// Utility to check $SEEN token balance for holder benefits
import { createPublicClient, http, erc20Abi } from 'viem';
import { base } from 'viem/chains';

const TOKEN_CONTRACT = process.env.CLAIM_TOKEN_CONTRACT;

// Holder benefit tiers
export const HOLDER_TIERS = {
  WHALE: {
    minBalance: 30_000_000, // 30M tokens
    claimMultiplier: 2,     // 2x daily claims
    featuredDiscount: 0.30, // 30% off featured pricing
    label: 'WHALE',
  },
  DOLPHIN: {
    minBalance: 10_000_000, // 10M tokens
    claimMultiplier: 1.5,   // 1.5x claim amount
    featuredDiscount: 0.20, // 20% off featured pricing
    label: 'DOLPHIN',
  },
  HOLDER: {
    minBalance: 1_000_000,  // 1M tokens
    claimMultiplier: 1,     // Normal claims
    featuredDiscount: 0.10, // 10% off featured pricing
    label: 'HOLDER',
  },
  NONE: {
    minBalance: 0,
    claimMultiplier: 1,
    featuredDiscount: 0,
    label: 'NONE',
  },
};

/**
 * Get $SEEN token balance for a wallet address
 * @param {string} walletAddress - The wallet address to check
 * @returns {Promise<{balance: bigint, balanceFormatted: number, tier: object}>}
 */
export async function getTokenBalance(walletAddress) {
  if (!TOKEN_CONTRACT || !walletAddress) {
    return { balance: 0n, balanceFormatted: 0, tier: HOLDER_TIERS.NONE };
  }

  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(),
    });

    const balance = await publicClient.readContract({
      address: TOKEN_CONTRACT,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [walletAddress],
    });

    // Convert from wei (18 decimals) to token units
    const balanceFormatted = Number(balance) / 1e18;
    
    // Determine tier
    const tier = getHolderTier(balanceFormatted);

    return {
      balance,
      balanceFormatted,
      tier,
    };
  } catch (error) {
    console.error('Error fetching token balance:', error);
    return { balance: 0n, balanceFormatted: 0, tier: HOLDER_TIERS.NONE };
  }
}

/**
 * Determine holder tier based on balance
 * @param {number} balance - Token balance in token units (not wei)
 * @returns {object} - The holder tier object
 */
export function getHolderTier(balance) {
  if (balance >= HOLDER_TIERS.WHALE.minBalance) return HOLDER_TIERS.WHALE;
  if (balance >= HOLDER_TIERS.DOLPHIN.minBalance) return HOLDER_TIERS.DOLPHIN;
  if (balance >= HOLDER_TIERS.HOLDER.minBalance) return HOLDER_TIERS.HOLDER;
  return HOLDER_TIERS.NONE;
}

/**
 * Calculate featured price with holder discount
 * @param {number} basePrice - Base price in USD
 * @param {number} discountPercent - Discount as decimal (0.30 = 30%)
 * @returns {number} - Discounted price
 */
export function calculateDiscountedPrice(basePrice, discountPercent) {
  return basePrice * (1 - discountPercent);
}

