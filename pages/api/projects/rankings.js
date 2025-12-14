// API route to get project rankings by category
import { getAllCategoryRankings, getRankedProjectsByCategory } from '../../../lib/projects';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { category, limit } = req.query;
    const limitNum = limit ? parseInt(limit) : 10;

    if (category) {
      // Get rankings for specific category
      const rankings = await getRankedProjectsByCategory(category, limitNum);
      return res.status(200).json({
        category,
        rankings,
      });
    } else {
      // Get rankings for all categories
      const allRankings = await getAllCategoryRankings(limitNum);
      return res.status(200).json({
        rankings: allRankings,
      });
    }
  } catch (error) {
    console.error('Error fetching rankings:', error);
    res.status(500).json({ error: 'Failed to fetch rankings' });
  }
}
