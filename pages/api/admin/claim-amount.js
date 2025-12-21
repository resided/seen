// Manage claim amount configuration
import { getRedisClient } from '../../../lib/redis';
import { isAuthenticated } from '../../../lib/admin-auth';

const CLAIM_AMOUNT_KEY = 'config:claim:amount';
const DEFAULT_CLAIM_AMOUNT = '40000';

export default async function handler(req, res) {
  const isAdmin = await isAuthenticated(req);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const redis = await getRedisClient();
  if (!redis) {
    return res.status(500).json({ error: 'Redis unavailable' });
  }

  // GET - fetch current claim amount
  if (req.method === 'GET') {
    try {
      const amount = await redis.get(CLAIM_AMOUNT_KEY);
      return res.status(200).json({
        claimAmount: amount || DEFAULT_CLAIM_AMOUNT,
      });
    } catch (error) {
      console.error('[CLAIM AMOUNT] Error fetching:', error);
      return res.status(500).json({ error: 'Failed to fetch claim amount' });
    }
  }

  // POST - update claim amount
  if (req.method === 'POST') {
    try {
      const { amount } = req.body;

      if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }

      await redis.set(CLAIM_AMOUNT_KEY, amount.toString());

      console.log('[CLAIM AMOUNT] Updated:', { old: await redis.get(CLAIM_AMOUNT_KEY), new: amount });

      return res.status(200).json({
        success: true,
        claimAmount: amount,
      });
    } catch (error) {
      console.error('[CLAIM AMOUNT] Error updating:', error);
      return res.status(500).json({ error: 'Failed to update claim amount' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
