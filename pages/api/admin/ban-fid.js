// Admin endpoint to ban/unban FIDs from chat
import { getRedisClient } from '../../../lib/redis';
import { isAuthenticated } from '../../../lib/admin-auth';

const BANNED_FIDS_KEY = 'chat:banned:fids';

export default async function handler(req, res) {
  // Check admin authentication
  const authed = await isAuthenticated(req);
  if (!authed) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const redis = await getRedisClient();
  if (!redis) {
    return res.status(500).json({ error: 'Redis unavailable' });
  }

  // POST = Ban FID
  if (req.method === 'POST') {
    const { fid, reason } = req.body;

    if (!fid) {
      return res.status(400).json({ error: 'FID required' });
    }

    const fidNum = parseInt(fid);
    if (isNaN(fidNum) || fidNum <= 0) {
      return res.status(400).json({ error: 'Invalid FID' });
    }

    try {
      // Add FID to banned set with reason and timestamp
      await redis.hSet(`${BANNED_FIDS_KEY}:${fidNum}`, {
        fid: fidNum.toString(),
        reason: reason || 'No reason provided',
        bannedAt: new Date().toISOString(),
      });

      // Also add to set for quick lookup
      await redis.sAdd(BANNED_FIDS_KEY, fidNum.toString());

      console.log(`[ADMIN] Banned FID ${fidNum} from chat`);

      return res.status(200).json({
        success: true,
        message: 'FID banned from chat',
        fid: fidNum,
      });
    } catch (error) {
      console.error('[ADMIN] Error banning FID:', error);
      return res.status(500).json({
        error: 'Failed to ban FID',
        details: error.message,
      });
    }
  }

  // DELETE = Unban FID
  if (req.method === 'DELETE') {
    const { fid } = req.body;

    if (!fid) {
      return res.status(400).json({ error: 'FID required' });
    }

    const fidNum = parseInt(fid);
    if (isNaN(fidNum) || fidNum <= 0) {
      return res.status(400).json({ error: 'Invalid FID' });
    }

    try {
      // Remove from set
      await redis.sRem(BANNED_FIDS_KEY, fidNum.toString());

      // Remove ban details
      await redis.del(`${BANNED_FIDS_KEY}:${fidNum}`);

      console.log(`[ADMIN] Unbanned FID ${fidNum} from chat`);

      return res.status(200).json({
        success: true,
        message: 'FID unbanned from chat',
        fid: fidNum,
      });
    } catch (error) {
      console.error('[ADMIN] Error unbanning FID:', error);
      return res.status(500).json({
        error: 'Failed to unban FID',
        details: error.message,
      });
    }
  }

  // GET = List banned FIDs
  if (req.method === 'GET') {
    try {
      const bannedFids = await redis.sMembers(BANNED_FIDS_KEY);

      if (!bannedFids || bannedFids.length === 0) {
        return res.status(200).json({
          bannedFids: [],
          total: 0,
        });
      }

      // Get details for each banned FID
      const bannedDetails = await Promise.all(
        bannedFids.map(async (fid) => {
          const details = await redis.hGetAll(`${BANNED_FIDS_KEY}:${fid}`);
          return {
            fid: parseInt(fid),
            reason: details.reason || 'No reason',
            bannedAt: details.bannedAt || 'Unknown',
          };
        })
      );

      return res.status(200).json({
        bannedFids: bannedDetails,
        total: bannedDetails.length,
      });
    } catch (error) {
      console.error('[ADMIN] Error fetching banned FIDs:', error);
      return res.status(500).json({
        error: 'Failed to fetch banned FIDs',
        details: error.message,
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
