// API route to track tips sent to builders
import { getRedisClient } from '../../lib/redis';
import { updateProjectStats } from '../../lib/projects';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { projectId, amount, recipientFid } = req.body;

    if (!projectId || !amount) {
      return res.status(400).json({ error: 'Missing projectId or amount' });
    }

    const redis = await getRedisClient();
    if (!redis) {
      return res.status(200).json({ success: true, tracked: false });
    }

    // Track tip in project stats
    try {
      const { getProjectById } = await import('../../lib/projects');
      const project = await getProjectById(parseInt(projectId));
      
      if (project) {
        const currentTips = parseFloat(project.stats?.tips || 0);
        const tipAmount = parseFloat(amount) || 0;
        const newTipsTotal = currentTips + tipAmount;
        
        await updateProjectStats(parseInt(projectId), {
          tips: newTipsTotal,
        });
      }
      
      // Also track individual tips for analytics
      const tipKey = `tip:${projectId}:${Date.now()}`;
      await redis.hSet(tipKey, {
        projectId: projectId.toString(),
        amount: amount.toString(),
        recipientFid: recipientFid?.toString() || '',
        timestamp: Date.now().toString(),
      });
      
      // Set expiration (keep tips for 30 days)
      await redis.expire(tipKey, 30 * 24 * 60 * 60);
    } catch (error) {
      console.error('Error tracking tip:', error);
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
