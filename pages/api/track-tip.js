// API route to track tips sent to builders
import { getRedisClient } from '../../lib/redis';
import { updateProjectStats } from '../../lib/projects';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting: 50 requests per IP per minute
  const { checkRateLimit, getClientIP } = await import('../../lib/rate-limit');
  const clientIP = getClientIP(req);
  const rateLimit = await checkRateLimit(`tip:${clientIP}`, 50, 60000);
  if (!rateLimit.allowed) {
    return res.status(429).json({ 
      error: 'Too many requests. Please slow down.',
      retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
    });
  }

  try {
    const { projectId, amount, recipientFid } = req.body;

    // Validate inputs
    if (!projectId || !amount) {
      return res.status(400).json({ error: 'Missing projectId or amount' });
    }

    // Validate projectId is a positive integer
    const projectIdNum = parseInt(projectId);
    if (isNaN(projectIdNum) || projectIdNum <= 0 || projectIdNum > 2147483647) {
      return res.status(400).json({ error: 'Invalid projectId' });
    }

    // Validate amount is a positive number
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0 || amountNum > 1e10) {
      return res.status(400).json({ error: 'Invalid amount. Must be a positive number' });
    }

    // Validate recipientFid if provided
    if (recipientFid !== undefined && recipientFid !== null) {
      const recipientFidNum = parseInt(recipientFid);
      if (isNaN(recipientFidNum) || recipientFidNum <= 0) {
        return res.status(400).json({ error: 'Invalid recipientFid' });
      }
    }

    const redis = await getRedisClient();
    if (!redis) {
      return res.status(200).json({ success: true, tracked: false });
    }

    // Track tip in project stats
    try {
      const { getProjectById } = await import('../../lib/projects');
      const project = await getProjectById(projectIdNum);

      if (!project) {
        console.error('[TRACK-TIP] Project not found:', projectIdNum);
        return res.status(404).json({
          success: false,
          error: 'Project not found',
          tracked: false
        });
      }

      const currentTips = parseFloat(project.stats?.tips || 0);
      const newTipsTotal = currentTips + amountNum;

      console.log('[TRACK-TIP] Updating tips:', {
        projectId: projectIdNum,
        projectName: project.name,
        currentTips,
        tipAmount: amountNum,
        newTotal: newTipsTotal
      });

      const updated = await updateProjectStats(projectIdNum, {
        tips: newTipsTotal,
      });

      if (!updated) {
        console.error('[TRACK-TIP] Failed to update project stats');
        return res.status(500).json({
          success: false,
          error: 'Failed to update stats',
          tracked: false
        });
      }

      console.log('[TRACK-TIP] Successfully updated tips to:', newTipsTotal);

      // Also track individual tips for analytics
      const tipKey = `tip:${projectIdNum}:${Date.now()}`;
      await redis.hSet(tipKey, {
        projectId: projectIdNum.toString(),
        amount: amountNum.toString(),
        recipientFid: recipientFid !== undefined && recipientFid !== null ? parseInt(recipientFid).toString() : '',
        timestamp: Date.now().toString(),
      });

      // Set expiration (keep tips for 30 days)
      await redis.expire(tipKey, 30 * 24 * 60 * 60);
    } catch (error) {
      console.error('[TRACK-TIP] Error tracking tip:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
        tracked: false
      });
    }

    return res.status(200).json({ 
      success: true, 
      tracked: true,
    });
  } catch (error) {
    console.error('Error tracking tip:', error);
    return res.status(200).json({ success: true, tracked: false });
  }
}
