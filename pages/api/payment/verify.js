// API route to verify payment and record it
import { recordFeaturedPayment, checkFeaturedPaymentCooldown } from '../../../lib/projects';
import { checkRateLimit, getClientIP } from '../../../lib/rate-limit';
import { verifyEthereumTransaction, isValidTxHash } from '../../../lib/payment-verification';
import { parseEther } from 'viem';

// Featured listing payment configuration
const FEATURED_PAYMENT_AMOUNT_ETH = '0.0042'; // 0.0042 ETH (~$10-15 depending on ETH price)
const PAYMENT_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // SECURITY: Rate limit payment verification (10 per hour per IP)
  const clientIP = getClientIP(req);
  const rateLimit = await checkRateLimit(`payment-verify:${clientIP}`, 10, 60 * 60 * 1000);

  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: 'Too many payment verification attempts. Please try again later.',
      resetAt: rateLimit.resetAt,
    });
  }

  const { fid, txHash } = req.body;

  if (!fid) {
    return res.status(400).json({ error: 'FID is required' });
  }

  // SECURITY: Require transaction hash (no more accepting null payments)
  if (!txHash) {
    return res.status(400).json({ error: 'Transaction hash is required for payment verification' });
  }

  // SECURITY: Validate transaction hash format
  if (!isValidTxHash(txHash)) {
    return res.status(400).json({ error: 'Invalid transaction hash format' });
  }

  try {
    // Check cooldown first
    const cooldown = await checkFeaturedPaymentCooldown(parseInt(fid));

    if (!cooldown.allowed) {
      return res.status(429).json({
        error: `You can only submit one featured project per 24 hours. Please wait ${cooldown.hoursRemaining} more hour(s).`,
        hoursRemaining: cooldown.hoursRemaining,
      });
    }

    // Get treasury address from environment
    const treasuryAddress = process.env.TREASURY_ADDRESS;
    if (!treasuryAddress) {
      console.error('[PAYMENT VERIFY] Treasury address not configured');
      return res.status(500).json({ error: 'Payment system not configured' });
    }

    // SECURITY: Verify the transaction on-chain
    const expectedAmountWei = parseEther(FEATURED_PAYMENT_AMOUNT_ETH).toString();
    const verification = await verifyEthereumTransaction(
      txHash,
      treasuryAddress,
      expectedAmountWei,
      PAYMENT_MAX_AGE_MS
    );

    if (!verification.valid) {
      console.error('[PAYMENT VERIFY] Transaction verification failed:', verification.error);
      return res.status(400).json({
        error: 'Payment verification failed',
        details: verification.error,
      });
    }

    console.log('[PAYMENT VERIFY] Transaction verified successfully:', {
      txHash,
      from: verification.details.from,
      to: verification.details.to,
      value: verification.details.value,
    });

    // Record the verified payment
    const recorded = await recordFeaturedPayment(parseInt(fid), txHash);

    if (recorded) {
      return res.status(200).json({
        success: true,
        message: 'Payment verified and recorded successfully',
        verification: {
          txHash,
          amount: FEATURED_PAYMENT_AMOUNT_ETH,
          verified: true,
        },
      });
    } else {
      return res.status(500).json({ error: 'Failed to record payment' });
    }
  } catch (error) {
    console.error('[PAYMENT VERIFY] Error:', error);
    return res.status(500).json({ error: 'Failed to verify payment' });
  }
}
