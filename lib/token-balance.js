// Utility to check $SEEN token balance for holder benefits
import { createPublicClient, http, erc20Abi } from 'viem';
import { base } from 'viem/chains';

const TOKEN_CONTRACT = process.env.CLAIM_TOKEN_CONTRACT;

// Holder benefit threshold
export const HOLDER_THRESHOLD = 30_000_000; // 30M tokens for 2x claims
export const HOLDER_DISCOUNT = 0.20; // 20% discount on featured pricing

/**
 * Get $SEEN token balance for a wallet address
 * @param {string} walletAddress - The wallet address to check
 * @returns {Promise<{balance: bigint, balanceFormatted: number, isHolder: boolean}>}
 */
export async function getTokenBalance(walletAddress) {
  if (!TOKEN_CONTRACT || !walletAddress) {
    return { balance: 0n, balanceFormatted: 0, isHolder: false };
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
    
    // Check if meets 30M threshold
    const isHolder = balanceFormatted >= HOLDER_THRESHOLD;

    return {
      balance,
      balanceFormatted,
      isHolder,
    };
  } catch (error) {
    console.error('Error fetching token balance:', error);
    return { balance: 0n, balanceFormatted: 0, isHolder: false };
  }
}

