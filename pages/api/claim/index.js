// API route to claim tokens (tied to featured project rotation)
import { getRedisClient } from '../../../lib/redis';
import { getFeaturedProject } from '../../../lib/projects';
import { fetchUserByFid } from '../../../lib/neynar';
import { getTokenBalance, HOLDER_THRESHOLD } from '../../../lib/token-balance';
import { createWalletClient, createPublicClient, http, parseUnits } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { erc20Abi } from 'viem';

const MIN_NEYNAR_SCORE = 0.62; // Minimum Neynar user score required to claim
const WHALE_CLAIM_LIMIT = 2; // Whales (30M+) can claim 2x daily

// Token configuration from environment variables
// To change claim amount, update CLAIM_TOKEN_AMOUNT in your environment variables
const TOKEN_CONTRACT = process.env.CLAIM_TOKEN_CONTRACT; // ERC20 token contract address
const TOKEN_AMOUNT = process.env.CLAIM_TOKEN_AMOUNT || '80000'; // Amount to send (in token units, not wei) - Default: 80,000
const TOKEN_DECIMALS = parseInt(process.env.CLAIM_TOKEN_DECIMALS || '18'); // Token decimals
const TREASURY_PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY; // Private key of wallet holding tokens (0x prefix)
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS; // Treasury wallet address (for verification) - REQUIRED
const REQUIRE_USER_TX = process.env.REQUIRE_USER_TX !== 'false'; // Allow disabling in env if needed

// DONUT token bonus configuration (one-time feature)
const DONUT_TOKEN_CONTRACT = '0xAE4a37d554C6D6F3E398546d8566B25052e0169C'; // DONUT token address
const DONUT_TOKEN_AMOUNT = '1'; // 1 DONUT per person
const DONUT_TOKEN_DECIMALS = 18; // Standard ERC20 decimals
const DONUT_MAX_SUPPLY = 1000; // Maximum 1,000 DONUT tokens to give out
// DONUT is just an add-on - doesn't change SEEN amount (always 80k per claim)
const DONUT_COUNT_KEY = 'donut:count:given'; // Redis key to track DONUT tokens given

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // EMERGENCY KILL SWITCH - set CLAIMS_DISABLED=true in Vercel env to stop all claims
  if (process.env.CLAIMS_DISABLED === 'true') {
    return res.status(503).json({ error: 'Claims temporarily disabled for maintenance' });
  }

  try {
    const { fid, walletAddress, txHash } = req.body;

    if (!fid) {
      return res.status(400).json({ error: 'FID is required' });
    }

    if (!walletAddress && !txHash) {
      return res.status(400).json({ error: 'Wallet address is required for claiming' });
    }

    // Check if user is a 30M+ holder first (holders bypass Neynar score requirement)
    let isHolder = false;
    if (walletAddress) {
      try {
        const { isHolder: holderStatus } = await getTokenBalance(walletAddress);
        isHolder = holderStatus;
      } catch (balanceError) {
        console.error('Error checking holder status for Neynar bypass:', balanceError);
        // Continue to check Neynar score if we can't verify holder status
      }
    }

    // Check Neynar user score (30M+ holders bypass this requirement)
    const apiKey = process.env.NEYNAR_API_KEY;
    if (apiKey && !isHolder) { // Only check Neynar score if not a 30M+ holder
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
    } else if (isHolder) {
      console.log(`30M+ holder ${fid} bypassing Neynar score requirement`);
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

    // Track claim by featured project ID + featuredAt timestamp + FID AND wallet
    // This prevents FID spoofing attacks - claims tracked by both FID and wallet
    const featuredAtTimestamp = Math.floor(featuredAt.getTime() / 1000); // Unix timestamp in seconds
    const claimKey = `claim:featured:${featuredProjectId}:${featuredAtTimestamp}:${fid}`;
    const claimCountKey = `claim:count:${featuredProjectId}:${featuredAtTimestamp}:${fid}`;
    
    // SECURITY: Also track by wallet address to prevent FID spoofing
    const walletClaimCountKey = `claim:wallet:${featuredProjectId}:${featuredAtTimestamp}:${walletAddress.toLowerCase()}`;
    
    // SECURITY: Test bypass removed - no FID gets special treatment
    const isBypassEnabled = false;
    
    // Set maxClaims based on holder status (already checked above for Neynar bypass)
    let maxClaims = 1;
    if (isHolder) {
      maxClaims = WHALE_CLAIM_LIMIT; // Holders with 30M+ get 2 claims per featured project
    }
    
    // Log claim attempt for debugging
    console.log('Claim attempt:', {
      fid,
      walletAddress: walletAddress?.slice(0, 10) + '...',
      featuredProjectId,
      featuredAtTimestamp,
      isHolder,
      maxClaims
    });
    
    // SECURITY: Check WALLET claim count FIRST to prevent FID spoofing attacks
    // This ensures a wallet can't claim unlimited times by cycling through FIDs
    const walletClaimCount = await redis.incr(walletClaimCountKey);
    
    if (walletClaimCount > maxClaims && !isBypassEnabled) {
      // Rollback the increment
      await redis.decr(walletClaimCountKey);
      console.warn('SECURITY: Wallet claim limit exceeded (possible FID spoofing attempt):', {
        fid,
        walletAddress: walletAddress?.slice(0, 10) + '...',
        walletClaimCount,
        maxClaims,
        featuredProjectId,
        featuredAtTimestamp
      });
      return res.status(400).json({ 
        error: 'This wallet has already claimed the maximum allowed for this featured project',
        featuredProjectId,
        walletClaimCount: walletClaimCount - 1,
        maxClaims,
        isHolder,
      });
    }
    
    // ATOMIC CHECK: Check FID claim count for this featured rotation
    // Use INCR to atomically increment and get the new value
    const newClaimCount = await redis.incr(claimCountKey);
    
    console.log('Claim count check:', {
      fid,
      walletAddress: walletAddress?.slice(0, 10) + '...',
      newClaimCount,
      walletClaimCount,
      maxClaims,
      isBypassEnabled,
      featuredProjectId,
      featuredAtTimestamp,
      claimCountKey,
      walletClaimCountKey,
      willAllow: newClaimCount <= maxClaims || isBypassEnabled
    });
    
    // If FID claim count exceeds max, decrement both counters and reject
    if (newClaimCount > maxClaims && !isBypassEnabled) {
      // Rollback both increments
      await redis.decr(claimCountKey);
      await redis.decr(walletClaimCountKey);
      console.warn('Claim rejected - FID exceeded max:', {
        fid,
        walletAddress: walletAddress?.slice(0, 10) + '...',
        newClaimCount,
        maxClaims,
        featuredProjectId,
        featuredAtTimestamp,
        claimCountKey
      });
      return res.status(400).json({ 
        error: isHolder 
          ? `Already claimed ${maxClaims}x for this featured project (30M+ holder benefit used)`
          : 'Already claimed for this featured project rotation',
        featuredProjectId,
        featuredAt: featuredAt.toISOString(),
        expirationTime: expirationTime.toISOString(),
        claimCount: newClaimCount - 1,
        maxClaims,
        isHolder,
      });
    }
    
    // Additional safety: Log if someone is claiming more than expected
    if (newClaimCount > maxClaims) {
      console.error('CRITICAL: Claim count exceeded maxClaims but was allowed!', {
        fid,
        walletAddress: walletAddress?.slice(0, 10) + '...',
        newClaimCount,
        walletClaimCount,
        maxClaims,
        isBypassEnabled,
        featuredProjectId,
        featuredAtTimestamp
      });
    }
    
    // Set expiration on both claim count keys
    const ttl = Math.max(0, Math.floor((expirationTime - now) / 1000));
    await redis.expire(claimCountKey, ttl);
    await redis.expire(walletClaimCountKey, ttl);

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

    // If user tx is required, verify provided txHash (unless bypass)
    if (REQUIRE_USER_TX && !isBypassEnabled) {
      if (!txHash) {
        return res.status(400).json({ error: 'Transaction hash required for claiming' });
      }

      // PREVENT REPLAY ATTACK: Atomically check AND lock this txHash using SETNX
      // This prevents race conditions where multiple requests check before any marks as used
      const txHashKey = `claim:txhash:${txHash.toLowerCase()}`;
      const txHashLockResult = await redis.set(txHashKey, 'pending', { NX: true });
      
      // If SETNX returns null, key already exists = txHash already used
      if (txHashLockResult !== 'OK') {
        return res.status(400).json({ 
          error: 'This transaction hash has already been used for a claim',
          replay: true
        });
      }
      
      // txHash is now atomically locked - will be marked as 'used' on success, or deleted on failure

      try {
        const publicClient = createPublicClient({
          chain: base,
          transport: http(),
        });

        const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
        if (!receipt || receipt.status !== 'success') {
          return res.status(400).json({ error: 'Transaction not successful or not found' });
        }

        // Basic sender/recipient validation
        const tx = await publicClient.getTransaction({ hash: txHash });
        const senderMatches = tx.from?.toLowerCase() === walletAddress.toLowerCase();
        const recipientMatches = TREASURY_ADDRESS
          ? (tx.to?.toLowerCase() === TREASURY_ADDRESS.toLowerCase())
          : !!tx.to;

        if (!senderMatches) {
          return res.status(400).json({ error: 'Transaction sender does not match claiming wallet' });
        }

        if (!recipientMatches) {
          return res.status(400).json({ error: 'Transaction not sent to treasury address' });
        }

        // Optional: ensure data contains "claim" marker if present
        if (tx.input && tx.input !== '0x') {
          const inputLower = tx.input.toLowerCase();
          if (!inputLower.includes('636c61696d')) { // hex for 'claim'
            console.warn('Claim tx input missing claim marker');
          }
        }
      } catch (verifyError) {
        console.error('Error verifying user transaction:', verifyError);
        return res.status(400).json({ error: 'Failed to verify user transaction' });
      }
    }

    // Send tokens from treasury wallet
    // Declare variables outside try block for rollback access
    const userDonutKey = `donut:user:${fid}`;
    let userCanGetDonut = false;
    
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

      // ATOMIC CHECK: Check DONUT availability (global count and per-user)
      // Use SET with NX to atomically check and mark user as having received DONUT
      const userDonutLockResult = await redis.set(userDonutKey, '1', { NX: true }); // SET if Not eXists (atomic)
      // Returns "OK" if key was set (user didn't have DONUT), null if key already exists (user already has DONUT)
      userCanGetDonut = userDonutLockResult === 'OK';
      
      // Check global DONUT count
      const donutCountGiven = parseInt(await redis.get(DONUT_COUNT_KEY) || '0');
      const donutGlobalAvailable = donutCountGiven < DONUT_MAX_SUPPLY;
      
      // User can get DONUT if: global available AND we just marked them (they didn't have it before)
      const donutAvailable = donutGlobalAvailable && userCanGetDonut;
      
      // If user already had DONUT, nothing to do (lock result was null)
      
      // SEEN amount is ALWAYS 80,000 per claim - no exceptions
      // - Regular users: 1 claim = 80,000 SEEN
      // - 30M+ holders: 2 claims = 2 x 80,000 = 160,000 SEEN total (but each TX is 80k)
      // DONUT is just an add-on: 1 DONUT per person, once only, while supply lasts
      const seenAmount = TOKEN_AMOUNT; // Always 80,000
      const seenAmountWei = parseUnits(seenAmount, TOKEN_DECIMALS);
      
      console.log('Sending tokens:', {
        donutAvailable,
        donutCountGiven,
        donutMaxSupply: DONUT_MAX_SUPPLY,
        seenContract: TOKEN_CONTRACT,
        seenAmount,
        donutContract: donutAvailable ? DONUT_TOKEN_CONTRACT : null,
        donutAmount: donutAvailable ? DONUT_TOKEN_AMOUNT : null,
        to: walletAddress,
        from: account.address,
      });

      // Verify featured project hasn't changed during claim process (prevent multi-claim exploit)
      const currentFeaturedProject = await getFeaturedProject();
      if (!currentFeaturedProject || currentFeaturedProject.id !== featuredProjectId) {
        // Featured project changed - rollback and reject
        await redis.decr(claimCountKey);
        await redis.decr(walletClaimCountKey);
        if (userCanGetDonut) {
          await redis.del(userDonutKey);
        }
        // Release txHash lock so user can retry
        if (txHash) {
          await redis.del(`claim:txhash:${txHash.toLowerCase()}`);
        }
        return res.status(400).json({ 
          error: 'Featured project changed during claim. Please try again.',
          featuredProjectChanged: true
        });
      }
      
      // Send SEEN tokens first
      const seenHash = await walletClient.writeContract({
        address: TOKEN_CONTRACT,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [walletAddress, seenAmountWei],
      });

      // Send DONUT token if available (1 per user max)
      let donutHash = null;
      if (donutAvailable) {
        const donutAmountWei = parseUnits(DONUT_TOKEN_AMOUNT, DONUT_TOKEN_DECIMALS);
        donutHash = await walletClient.writeContract({
          address: DONUT_TOKEN_CONTRACT,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [walletAddress, donutAmountWei],
        });
        
        // Increment global DONUT count (persistent, doesn't expire)
        // User is already marked via SETNX above
        await redis.incr(DONUT_COUNT_KEY);
      } else if (userCanGetDonut && !donutGlobalAvailable) {
        // Race condition: user got lock but DONUT ran out - release the lock
        await redis.del(userDonutKey);
      }

      // Use SEEN hash as primary hash (for backward compatibility)
      const hash = seenHash;

      // Calculate TTL: time until expiration (expires when featured project changes)
      const ttl = Math.max(0, Math.floor((expirationTime - now) / 1000));
      
      // Record the claim with transaction hash (expires when featured project changes)
      await redis.setEx(claimKey, ttl, newClaimCount.toString());
      // If txHash was provided (user transaction), use that, otherwise use treasury tx hash
      const userTxHash = txHash || hash;
      await redis.setEx(`claim:tx:${featuredProjectId}:${featuredAtTimestamp}:${fid}:${newClaimCount}`, ttl, userTxHash);
      
      // Mark txHash as permanently used (was locked as 'pending' earlier, now mark as 'used')
      // This is persistent and never expires to prevent replay attacks
      if (txHash) {
        await redis.set(`claim:txhash:${txHash.toLowerCase()}`, 'used');
      }

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

    // Build success message
    let successMessage = 'Tokens sent successfully';
    if (donutAvailable) {
      successMessage = `Tokens sent successfully! Bonus: 1 DONUT + ${seenAmount} $SEEN`;
    } else if (isHolder) {
      successMessage = `Tokens sent successfully! (Claim ${newClaimCount}/${maxClaims} - 30M+ holder benefit)`;
    }

    return res.status(200).json({
      success: true,
      message: successMessage,
      expirationTime: expirationTime.toISOString(),
      featuredProjectId,
      txHash: txHash || hash, // Return user's txHash if provided, otherwise treasury tx hash
      treasuryTxHash: hash, // Also return treasury transaction hash
      donutTxHash: donutHash, // DONUT transaction hash if sent
      amount: seenAmount, // Actual SEEN amount sent
      donutIncluded: donutAvailable, // Whether DONUT was included
      donutRemaining: Math.max(0, DONUT_MAX_SUPPLY - donutCountGiven - (donutAvailable ? 1 : 0)), // Remaining DONUT tokens
      claimCount: newClaimCount,
      maxClaims,
      isHolder,
      canClaimAgain: newClaimCount < maxClaims,
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

      // ROLLBACK: If token sending failed, rollback all claim count increments
      try {
        await redis.decr(claimCountKey);
        await redis.decr(walletClaimCountKey); // Also rollback wallet claim count
        // Also rollback DONUT user lock if we set it
        if (userCanGetDonut) {
          await redis.del(userDonutKey);
        }
        // Release txHash lock so user can retry with same txHash
        if (txHash) {
          await redis.del(`claim:txhash:${txHash.toLowerCase()}`);
        }
        // If we incremented global DONUT count, rollback (but we only increment after successful send, so this shouldn't happen)
      } catch (rollbackError) {
        console.error('Error rolling back claim:', rollbackError);
      }

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