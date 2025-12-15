// API route to claim tokens (tied to featured project rotation)
import { getRedisClient } from '../../../lib/redis';
import { getFeaturedProject } from '../../../lib/projects';
import { fetchUserByFid } from '../../../lib/neynar';
import { createWalletClient, http, parseUnits } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { erc20Abi } from 'viem';

const MIN_NEYNAR_SCORE = 0.62; // Minimum Neynar user score required to claim

// Token configuration from environment variables
// To change claim amount, update CLAIM_TOKEN_AMOUNT in your environment variables
const TOKEN_CONTRACT = process.env.CLAIM_TOKEN_CONTRACT; // ERC20 token contract address
const TOKEN_AMOUNT = process.env.CLAIM_TOKEN_AMOUNT || '80000'; // Amount to send (in token units, not wei) - Default: 80,000
const TOKEN_DECIMALS = parseInt(process.env.CLAIM_TOKEN_DECIMALS || '18'); // Token decimals
const TREASURY_PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY; // Private key of wallet holding tokens (0x prefix)
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS; // Treasury wallet address (for verification) - REQUIRED

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

    // Check Neynar user score
    const apiKey = process.env.NEYNAR_API_KEY;
    if (apiKey) {
      try {
        const user = await fetchUserByFid(parseInt(fid), apiKey);
        if (user) {
          const userScore = user.experimental?.neynar_user_score;
          
          // If score exists and is below threshold, reject claim
          if (userScore !== null && userScore !== undefined) {
            if (userScore < MIN_NEYNAR_SCORE) {
              return res.status(403).json({ 
                error: `Your Neynar user score (${userScore.toFixed(2)}) is below the required threshold of ${MIN_NEYNAR_SCORE}. Only users with a score of ${MIN_NEYNAR_SCORE} or higher can claim tokens.`,
                userScore: userScore,
                minScore: MIN_NEYNAR_SCORE
              });
            }
          } else {
            // If score is not available, allow claim but log it
            console.warn(`User ${fid} has no Neynar score available - allowing claim`);
          }
        }
      } catch (error) {
        console.error('Error checking Neynar user score:', error);
        // If we can't check the score, we'll allow claim but log the error
        // You might want to change this to reject if score checking is critical
      }
    }

    const redis = await getRedisClient();
    if (!redis) {
      return res.status(500).json({ error: 'Service unavailable' });
    }

    // Get current featured project to determine claim window
    const featuredProject = await getFeaturedProject();
    if (!featuredProject || !featuredProject.id) {
      return res.status(400).json({ error: 'No featured project available for claiming' });
    }

    const featuredProjectId = featuredProject.id;
    const featuredAt = featuredProject.featuredAt ? new Date(featuredProject.featuredAt) : new Date();
    
    // Calculate expiration: 24 hours from when project was featured
    const expirationTime = new Date(featuredAt.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    
    // Check if claim window has expired
    if (now > expirationTime) {
      return res.status(400).json({ 
        error: 'Claim window expired. New featured project must be set.',
        expired: true,
        featuredAt: featuredAt.toISOString(),
        expirationTime: expirationTime.toISOString(),
      });
    }

    // Track claim by featured project ID + featuredAt timestamp + FID
    // This allows users to claim again if the same project is featured again later
    const featuredAtTimestamp = Math.floor(featuredAt.getTime() / 1000); // Unix timestamp in seconds
    const claimKey = `claim:featured:${featuredProjectId}:${featuredAtTimestamp}:${fid}`;
    
    // Check if already claimed for this specific featured rotation
    // Always check regardless of txHash to prevent double-claiming
    const alreadyClaimed = await redis.exists(claimKey);
    if (alreadyClaimed) {
      return res.status(400).json({ 
        error: 'Already claimed for this featured project rotation',
        featuredProjectId,
        featuredAt: featuredAt.toISOString(),
        expirationTime: expirationTime.toISOString(),
      });
    }

    // If no token contract configured, return token details for client-side transaction
    if (!TOKEN_CONTRACT || !TREASURY_PRIVATE_KEY) {
      console.error('Token configuration missing:', {
        hasTokenContract: !!TOKEN_CONTRACT,
        hasTreasuryKey: !!TREASURY_PRIVATE_KEY,
        tokenContract: TOKEN_CONTRACT || 'NOT SET',
        treasuryKeyPrefix: TREASURY_PRIVATE_KEY ? `${TREASURY_PRIVATE_KEY.slice(0, 10)}...` : 'NOT SET',
      });
      return res.status(200).json({
        success: true,
        tokenContract: TOKEN_CONTRACT || null,
        amount: TOKEN_AMOUNT,
        decimals: TOKEN_DECIMALS,
        message: 'Token contract not configured. Please configure CLAIM_TOKEN_CONTRACT and TREASURY_PRIVATE_KEY environment variables.',
        expirationTime: expirationTime.toISOString(),
        featuredProjectId,
      });
    }

    // Send tokens from treasury wallet
    try {
      // Validate private key format
      if (!TREASURY_PRIVATE_KEY || !TREASURY_PRIVATE_KEY.startsWith('0x')) {
        return res.status(500).json({ 
          error: 'Treasury private key not configured properly. Must start with 0x' 
        });
      }

      // Validate token contract address format
      if (!TOKEN_CONTRACT || !TOKEN_CONTRACT.startsWith('0x') || TOKEN_CONTRACT.length !== 42) {
        return res.status(500).json({ 
          error: 'Invalid token contract address. Must be a valid Ethereum address (0x followed by 40 hex characters)',
          provided: TOKEN_CONTRACT || 'NOT SET'
        });
      }
      
      const account = privateKeyToAccount(TREASURY_PRIVATE_KEY);
      
      // Verify treasury address matches if provided
      if (TREASURY_ADDRESS && account.address.toLowerCase() !== TREASURY_ADDRESS.toLowerCase()) {
        console.warn(`Treasury address mismatch: expected ${TREASURY_ADDRESS}, got ${account.address}`);
      }
      
      const walletClient = createWalletClient({
        account,
        chain: base,
        transport: http(),
      });

      // Validate amount
      const tokenAmount = parseUnits(TOKEN_AMOUNT, TOKEN_DECIMALS);
      console.log('Sending tokens:', {
        contract: TOKEN_CONTRACT,
        to: walletAddress,
        amount: TOKEN_AMOUNT,
        amountWei: tokenAmount.toString(),
        decimals: TOKEN_DECIMALS,
        from: account.address,
      });

      // Send ERC20 tokens
      const hash = await walletClient.writeContract({
        address: TOKEN_CONTRACT,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [walletAddress, tokenAmount],
      });

      // Calculate TTL: time until expiration (expires when featured project changes)
      const ttl = Math.max(0, Math.floor((expirationTime - now) / 1000));
      const featuredAtTimestamp = Math.floor(featuredAt.getTime() / 1000);
      
      // Record the claim with transaction hash (expires when featured project changes)
      await redis.setEx(claimKey, ttl, '1');
      // If txHash was provided (user transaction), use that, otherwise use treasury tx hash
      const userTxHash = txHash || hash;
      await redis.setEx(`claim:tx:${featuredProjectId}:${featuredAtTimestamp}:${fid}`, ttl, userTxHash);

      // Track a click when user successfully claims (they opened the miniapp to claim)
      try {
        // Use window key based on featuredAt for featured projects (24-hour window)
        let windowKey;
        if (featuredProject?.featuredAt) {
          const featuredDate = new Date(featuredProject.featuredAt);
          windowKey = Math.floor(featuredDate.getTime() / 1000).toString();
        } else {
          // Fallback to calendar date if no featuredAt
          windowKey = new Date().toISOString().split('T')[0];
        }
        
        const clickKey = `clicks:project:${featuredProjectId}:${windowKey}`;
        await redis.incr(clickKey);
        
        // Set expiration: 48 hours for featured (to cover full 24h window + buffer), 2 days for others
        const expiration = featuredProject?.featuredAt ? 48 * 60 * 60 : 2 * 24 * 60 * 60;
        await redis.expire(clickKey, expiration);
      } catch (clickError) {
        console.error('Error tracking click for claim:', clickError);
        // Don't fail the claim if click tracking fails
      }

      return res.status(200).json({
        success: true,
        message: 'Tokens sent successfully',
        expirationTime: expirationTime.toISOString(),
        featuredProjectId,
        txHash: txHash || hash, // Return user's txHash if provided, otherwise treasury tx hash
        treasuryTxHash: hash, // Also return treasury transaction hash
        amount: TOKEN_AMOUNT,
      });
    } catch (txError) {
      console.error('Error sending tokens:', {
        error: txError,
        message: txError.message,
        cause: txError.cause,
        contract: TOKEN_CONTRACT,
        amount: TOKEN_AMOUNT,
        decimals: TOKEN_DECIMALS,
        recipient: walletAddress,
      });

      // Provide more specific error messages
      let errorMessage = 'Failed to send tokens';
      let errorDetails = txError.message;

      if (txError.message?.includes('insufficient funds') || txError.message?.includes('balance')) {
        errorMessage = 'Insufficient token balance in treasury wallet';
        errorDetails = 'The treasury wallet does not have enough tokens to send. Please add tokens to the treasury wallet.';
      } else if (txError.message?.includes('execution reverted') || txError.message?.includes('revert')) {
        errorMessage = 'Token transfer failed - contract execution reverted';
        errorDetails = 'The token contract rejected the transfer. This could mean: (1) Invalid contract address, (2) Contract is not an ERC20 token, (3) Contract is paused, or (4) Transfer function failed.';
      } else if (txError.message?.includes('invalid address') || txError.message?.includes('address')) {
        errorMessage = 'Invalid contract address';
        errorDetails = 'The token contract address is not valid or the contract does not exist on Base network.';
      }

      return res.status(500).json({ 
        error: errorMessage,
        details: errorDetails,
        contract: TOKEN_CONTRACT,
        troubleshooting: {
          checkContract: 'Verify the contract address is correct and deployed on Base network',
          checkBalance: 'Verify the treasury wallet has enough tokens',
          checkContractType: 'Verify the contract is a valid ERC20 token with transfer() function',
          checkNetwork: 'Verify the contract is on Base network (not Ethereum mainnet)',
        }
      });
    }
  } catch (error) {
    console.error('Error processing claim:', error);
    return res.status(500).json({ error: 'Failed to process claim' });
  }
}