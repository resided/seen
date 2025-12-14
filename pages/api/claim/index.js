// API route to claim daily tokens
import { getRedisClient } from '../../../lib/redis';
import { createWalletClient, http, parseUnits } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { erc20Abi } from 'viem';

// Token configuration from environment variables
const TOKEN_CONTRACT = process.env.CLAIM_TOKEN_CONTRACT; // ERC20 token contract address
const TOKEN_AMOUNT = process.env.CLAIM_TOKEN_AMOUNT || '1000'; // Amount to send (in token units, not wei)
const TOKEN_DECIMALS = parseInt(process.env.CLAIM_TOKEN_DECIMALS || '18'); // Token decimals
const TREASURY_PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY; // Private key of wallet holding tokens

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fid, walletAddress, txHash } = req.body;

    if (!fid) {
      return res.status(400).json({ error: 'FID is required' });
    }

    if (!walletAddress && !txHash) {
      return res.status(400).json({ error: 'Wallet address is required for claiming' });
    }

    const redis = await getRedisClient();
    if (!redis) {
      return res.status(500).json({ error: 'Service unavailable' });
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const claimKey = `claim:daily:${fid}:${today}`;
    
    // Check if already claimed today
    const alreadyClaimed = await redis.exists(claimKey);
    if (alreadyClaimed && !txHash) {
      const nextClaimTime = new Date();
      nextClaimTime.setHours(24, 0, 0, 0);
      return res.status(400).json({ 
        error: 'Already claimed today',
        nextClaimTime: nextClaimTime.toISOString(),
      });
    }

    // If txHash is provided, just record the claim
    if (txHash) {
      await redis.setEx(claimKey, 25 * 60 * 60, '1');
      await redis.setEx(`claim:tx:${fid}:${today}`, 25 * 60 * 60, txHash);
      
      const nextClaimTime = new Date();
      nextClaimTime.setHours(24, 0, 0, 0);
      
      return res.status(200).json({
        success: true,
        message: 'Claim recorded successfully',
        nextClaimTime: nextClaimTime.toISOString(),
        txHash,
      });
    }

    // If no token contract configured, return token details for client-side transaction
    if (!TOKEN_CONTRACT || !TREASURY_PRIVATE_KEY) {
      // Return token details for client to handle transaction
      const nextClaimTime = new Date();
      nextClaimTime.setHours(24, 0, 0, 0);
      
      return res.status(200).json({
        success: true,
        tokenContract: TOKEN_CONTRACT || null,
        amount: TOKEN_AMOUNT,
        decimals: TOKEN_DECIMALS,
        message: 'Token contract not configured. Please configure CLAIM_TOKEN_CONTRACT and TREASURY_PRIVATE_KEY environment variables.',
        nextClaimTime: nextClaimTime.toISOString(),
      });
    }

    // Send tokens from treasury wallet
    try {
      const account = privateKeyToAccount(TREASURY_PRIVATE_KEY);
      const walletClient = createWalletClient({
        account,
        chain: base,
        transport: http(),
      });

      // Send ERC20 tokens
      const hash = await walletClient.writeContract({
        address: TOKEN_CONTRACT,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [walletAddress, parseUnits(TOKEN_AMOUNT, TOKEN_DECIMALS)],
      });

      // Record the claim with transaction hash
      await redis.setEx(claimKey, 25 * 60 * 60, '1');
      await redis.setEx(`claim:tx:${fid}:${today}`, 25 * 60 * 60, hash);

      const nextClaimTime = new Date();
      nextClaimTime.setHours(24, 0, 0, 0);

      return res.status(200).json({
        success: true,
        message: 'Tokens sent successfully',
        nextClaimTime: nextClaimTime.toISOString(),
        txHash: hash,
        amount: TOKEN_AMOUNT,
      });
    } catch (txError) {
      console.error('Error sending tokens:', txError);
      return res.status(500).json({ 
        error: 'Failed to send tokens',
        details: txError.message 
      });
    }
  } catch (error) {
    console.error('Error processing claim:', error);
    return res.status(500).json({ error: 'Failed to process claim' });
  }
}
