// API route to check claim status (tied to featured project)
import { getRedisClient } from '../../../lib/redis';
import { getFeaturedProject } from '../../../lib/projects';

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
      return res.status(200).json({ claimed: false, expired: false });
    }

    // Get current featured project
    const featuredProject = await getFeaturedProject();
    if (!featuredProject || !featuredProject.id) {
      return res.status(200).json({ 
        claimed: false, 
        expired: false,
        noFeaturedProject: true 
      });
    }

    const featuredProjectId = featuredProject.id;
    const featuredAt = featuredProject.featuredAt ? new Date(featuredProject.featuredAt) : new Date();
    
    // Calculate expiration: 24 hours from when project was featured
    const expirationTime = new Date(featuredAt.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    const expired = now > expirationTime;
    
    // Check if claimed for this specific featured rotation (includes featuredAt timestamp)
    // This allows users to claim again if the same project is featured again later
    const featuredAtTimestamp = Math.floor(featuredAt.getTime() / 1000); // Unix timestamp in seconds
    const claimKey = `claim:featured:${featuredProjectId}:${featuredAtTimestamp}:${fid}`;
    const claimed = await redis.exists(claimKey);

    return res.status(200).json({
      claimed: claimed === 1,
      expired,
      featuredProjectId,
      featuredAt: featuredAt.toISOString(),
      expirationTime: expirationTime.toISOString(),
      timeRemaining: expired ? 0 : Math.max(0, expirationTime - now),
    });
  } catch (error) {
    console.error('Error checking claim status:', error);
    return res.status(200).json({ claimed: false, expired: false });
  }
}
