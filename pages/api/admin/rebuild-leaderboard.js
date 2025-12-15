// Admin API to clear chat leaderboard - start fresh from 0
import { clearLeaderboard } from '../../../lib/chat';
import { parse } from 'cookie';

const ADMIN_FID = 342433;

function isAuthenticated(req) {
  const { fid } = req.body || {};
  if (fid && parseInt(fid) === ADMIN_FID) {
    return true;
  }

  const cookies = parse(req.headers.cookie || '');
  const sessionToken = cookies.admin_session;
  if (sessionToken) {
    return true;
  }

  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAuthenticated(req)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const result = await clearLeaderboard();
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Leaderboard cleared - counts will start fresh from 0',
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to clear leaderboard',
      });
    }
  } catch (error) {
    console.error('Error clearing leaderboard:', error);
    return res.status(500).json({ error: 'Failed to clear leaderboard' });
  }
}

