// API route to process scheduled featured projects (call via cron)
import { processScheduledFeaturedProjects } from '../../../lib/projects';
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

  // Allow unauthenticated for cron jobs (you can add a secret token check here)
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional: Check for cron secret token
  // const cronSecret = req.headers['x-cron-secret'];
  // if (cronSecret !== process.env.CRON_SECRET) {
  //   return res.status(403).json({ error: 'Unauthorized' });
  // }

  try {
    const featured = await processScheduledFeaturedProjects();
    
    return res.status(200).json({
      success: true,
      message: `Processed ${featured.length} scheduled project(s)`,
      featured,
    });
  } catch (error) {
    console.error('Error processing scheduled projects:', error);
    return res.status(500).json({ error: 'Failed to process scheduled projects' });
  }
}

