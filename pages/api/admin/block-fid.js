// API route to manage blocked FIDs (admin only)
import { getRedisClient } from '../../../lib/redis';
import { isAuthenticated } from '../../../lib/admin-auth';

const ADMIN_FID = 342433;
const BLOCKED_FIDS_KEY = 'admin:blocked:fids';


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await isAuthenticated(req))) {
    return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
  }

  try {
    const { action, fid } = req.body;
    
    if (!action || (action !== 'list' && !fid)) {
      return res.status(400).json({ error: 'Action and FID (if applicable) are required' });
    }

    const fidNum = parseInt(fid);
    if (fid && (isNaN(fidNum) || fidNum <= 0)) {
      return res.status(400).json({ error: 'Invalid FID format' });
    }

    const redis = await getRedisClient();
    if (!redis) {
      return res.status(500).json({ error: 'Redis not available' });
    }

    // Get current blocked FIDs list
    const blockedFidsJson = await redis.get(BLOCKED_FIDS_KEY);
    let blockedFids = blockedFidsJson ? JSON.parse(blockedFidsJson) : [];

    if (action === 'list') {
      return res.status(200).json({
        success: true,
        blockedFids: blockedFids.sort((a, b) => a - b),
        count: blockedFids.length
      });
    }

    if (action === 'add') {
      if (blockedFids.includes(fidNum)) {
        return res.status(200).json({
          success: true,
          message: `FID ${fidNum} is already blocked`,
          blockedFids: blockedFids.sort((a, b) => a - b),
          count: blockedFids.length
        });
      }

      blockedFids.push(fidNum);
      // Remove duplicates and sort
      blockedFids = [...new Set(blockedFids)].sort((a, b) => a - b);
      
      await redis.set(BLOCKED_FIDS_KEY, JSON.stringify(blockedFids));
      
      console.log(`[ADMIN] FID ${fidNum} blocked by admin`);
      
      return res.status(200).json({
        success: true,
        message: `FID ${fidNum} has been blocked`,
        blockedFids: blockedFids,
        count: blockedFids.length
      });
    }

    if (action === 'remove') {
      if (!blockedFids.includes(fidNum)) {
        return res.status(200).json({
          success: true,
          message: `FID ${fidNum} is not blocked`,
          blockedFids: blockedFids.sort((a, b) => a - b),
          count: blockedFids.length
        });
      }

      blockedFids = blockedFids.filter(f => f !== fidNum);
      
      await redis.set(BLOCKED_FIDS_KEY, JSON.stringify(blockedFids));
      
      console.log(`[ADMIN] FID ${fidNum} unblocked by admin`);
      
      return res.status(200).json({
        success: true,
        message: `FID ${fidNum} has been unblocked`,
        blockedFids: blockedFids.sort((a, b) => a - b),
        count: blockedFids.length
      });
    }

    return res.status(400).json({ error: 'Invalid action. Use "list", "add", or "remove"' });
  } catch (error) {
    console.error('Error managing blocked FIDs:', error);
    return res.status(500).json({ error: 'Failed to manage blocked FIDs', details: error.message });
  }
}

