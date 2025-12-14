// API route to verify payment and record it
import { recordFeaturedPayment, checkFeaturedPaymentCooldown } from '../../../lib/projects';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fid, txHash } = req.body;

  if (!fid) {
    return res.status(400).json({ error: 'FID is required' });
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

    // Record the payment
    const recorded = await recordFeaturedPayment(parseInt(fid), txHash || null);
    
    if (recorded) {
      return res.status(200).json({
        success: true,
        message: 'Payment recorded successfully',
      });
    } else {
      return res.status(500).json({ error: 'Failed to record payment' });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({ error: 'Failed to verify payment' });
  }
}
