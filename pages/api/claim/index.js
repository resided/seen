// API route to claim daily tokens
import { getRedisClient } from '../../../lib/redis';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fid } = req.body;

    if (!fid) {
      return res.status(400).json({ error: 'FID is required' });
    }

    const redis = await getRedisClient();
    if (!redis) {
      return res.status(500).json({ error: 'Service unavailable' });
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const claimKey = `claim:daily:${fid}:${today}`;
    
    // Check if already claimed today
    const alreadyClaimed = await redis.exists(claimKey);
    if (alreadyClaimed) {
      const nextClaimTime = new Date();
      nextClaimTime.setHours(24, 0, 0, 0);
      return res.status(400).json({ 
        error: 'Already claimed today',
        nextClaimTime: nextClaimTime.toISOString(),
      });
    }

    // Record the claim (expires in 25 hours to be safe)
    await redis.setEx(claimKey, 25 * 60 * 60, '1');

    // TODO: Implement actual token distribution logic here
    // This would typically:
    // 1. Verify wallet connection
    // 2. Send tokens to user's wallet address
    // 3. Record transaction hash
    
    // For now, just return success
    const nextClaimTime = new Date();
    nextClaimTime.setHours(24, 0, 0, 0);

    return res.status(200).json({
      success: true,
      message: 'Tokens claimed successfully',
      nextClaimTime: nextClaimTime.toISOString(),
      // In production, include transaction hash:
      // txHash: '0x...',
    });
  } catch (error) {
    console.error('Error processing claim:', error);
    return res.status(500).json({ error: 'Failed to process claim' });
  }
}
