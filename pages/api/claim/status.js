// API route to check daily claim status
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
      return res.status(200).json({ claimed: false });
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const claimKey = `claim:daily:${fid}:${today}`;
    
    const claimed = await redis.exists(claimKey);
    
    // Calculate next claim time (24 hours from now)
    const nextClaimTime = new Date();
    nextClaimTime.setHours(24, 0, 0, 0); // Next midnight

    return res.status(200).json({
      claimed: claimed === 1,
      nextClaimTime: nextClaimTime.toISOString(),
    });
  } catch (error) {
    console.error('Error checking claim status:', error);
    return res.status(200).json({ claimed: false });
  }
}
