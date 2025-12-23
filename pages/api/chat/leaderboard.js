// API route to get chat leaderboard (top message senders)
import { getChatLeaderboard } from '../../../lib/chat';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { limit } = req.query;
    const limitNum = limit ? Math.min(parseInt(limit), 50) : 10; // Max 50, default 10

    const leaderboard = await getChatLeaderboard(limitNum);

    return res.status(200).json({
      leaderboard,
      total: leaderboard.length,
    });
  } catch (error) {
    console.error('Error fetching chat leaderboard:', error);
    return res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
}
