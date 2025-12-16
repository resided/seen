// API route to get current featured project
import { getFeaturedProject } from '../../lib/projects';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const featured = await getFeaturedProject();
    
    if (!featured) {
      return res.status(200).json({ project: null });
    }

    return res.status(200).json({ project: featured });
  } catch (error) {
    console.error('Error fetching featured project:', error);
    return res.status(500).json({ error: 'Failed to fetch featured project' });
  }
}

