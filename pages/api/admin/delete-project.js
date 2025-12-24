// API endpoint to delete a project (admin only)
import { getRedisClient } from '../../../lib/redis';
import { isAuthenticated } from '../../../lib/admin-auth';

const PROJECTS_KEY = 'projects:all';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check admin authentication
  const authed = await isAuthenticated(req);
  if (!authed) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const redis = await getRedisClient();
  if (!redis) {
    return res.status(500).json({ error: 'Redis unavailable' });
  }

  const { projectId } = req.body;

  if (!projectId) {
    return res.status(400).json({ error: 'Project ID required' });
  }

  const projectIdNum = parseInt(projectId);
  if (isNaN(projectIdNum) || projectIdNum <= 0) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  try {
    // Get project details before deletion for logging
    const projectData = await redis.hGetAll(`project:${projectIdNum}`);

    if (!projectData || Object.keys(projectData).length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Remove from projects set
    await redis.sRem(PROJECTS_KEY, projectIdNum.toString());

    // Delete project hash
    await redis.del(`project:${projectIdNum}`);

    // Delete associated stats (window counters)
    const statsPattern = `*:project:${projectIdNum}:*`;
    let cursor = 0;
    const keysToDelete = [];

    do {
      const [nextCursor, foundKeys] = await redis.scan(cursor, {
        MATCH: statsPattern,
        COUNT: 100,
      });
      cursor = typeof nextCursor === 'string' ? parseInt(nextCursor, 10) : nextCursor;
      if (foundKeys && foundKeys.length > 0) {
        keysToDelete.push(...foundKeys);
      }
    } while (cursor !== 0);

    if (keysToDelete.length > 0) {
      await redis.del(keysToDelete);
    }

    console.log(`[ADMIN] Deleted project ${projectIdNum} (${projectData.name})`);
    console.log(`[ADMIN] Cleaned up ${keysToDelete.length} associated keys`);

    return res.status(200).json({
      success: true,
      message: 'Project deleted successfully',
      projectId: projectIdNum,
      projectName: projectData.name,
      deletedKeys: keysToDelete.length,
    });
  } catch (error) {
    console.error('[ADMIN] Error deleting project:', error);
    return res.status(500).json({
      error: 'Failed to delete project',
      details: error.message,
    });
  }
}
